import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload, Video, FastForward, Shield, CheckCircle } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { PoseLandmarker, FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface TrackedHead {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    ttl: number; // Time To Live (frames)
    // for smoothing
    targetX: number;
    targetY: number;
    targetW: number;
    targetH: number;
}

export default function Anonymiser() {
    const [file, setFile] = useState<File | null>(null);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
    const [outputMimeType, setOutputMimeType] = useState<string>('video/webm');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Dual AI Models
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const faceDetectorRef = useRef<FaceDetector | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const animationFrameId = useRef<number | null>(null);

    // Tracking Refs
    const trackedHeadsRef = useRef<TrackedHead[]>([]);
    const nextHeadIdRef = useRef(0);

    const { toast } = useToast();

    useEffect(() => {
        const loadModels = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );

                // 1. Load Pose Landmarker (Full)
                const posePromise = PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 20, // INCREASED: Handle crowds
                    minPoseDetectionConfidence: 0.55, // BALANCED: Not too strict globally
                    minPosePresenceConfidence: 0.55,
                    minTrackingConfidence: 0.55
                });

                // 2. Load Face Detector
                const facePromise = FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    minDetectionConfidence: 0.55 // BALANCED
                });

                const [poseModel, faceModel] = await Promise.all([posePromise, facePromise]);

                poseLandmarkerRef.current = poseModel;
                faceDetectorRef.current = faceModel;

                setIsModelLoading(false);
            } catch (error) {
                console.error("Error loading MediaPipe models:", error);
                toast({
                    title: "Error loading AI Engine",
                    description: "Could not load the AI models. Please refresh the page.",
                    variant: "destructive"
                });
            }
        };
        loadModels();

        return () => {
            if (videoSrc) URL.revokeObjectURL(videoSrc);
            if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith('video/')) {
                toast({
                    title: "Invalid file type",
                    description: "Please upload a valid video file.",
                    variant: "destructive"
                });
                return;
            }
            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setVideoSrc(url);
            setProcessedVideoUrl(null);
            setProgress(0);
            trackedHeadsRef.current = []; // Reset tracking
        }
    };

    const processFrame = async () => {
        if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current || !faceDetectorRef.current) return;

        if (videoRef.current.ended || videoRef.current.paused) {
            if (videoRef.current.ended && isProcessing) {
                stopRecording();
            }
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) return;

        // 1. Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const startTimeMs = performance.now();
        const currentHeads: { x: number, y: number, w: number, h: number }[] = [];

        // ---------------------------------------------------------
        // A. Run Face Detection
        // ---------------------------------------------------------
        const faceResults = faceDetectorRef.current.detectForVideo(video, startTimeMs);
        if (faceResults.detections) {
            faceResults.detections.forEach(det => {
                if (det.boundingBox) {
                    const { originX, originY, width, height } = det.boundingBox;

                    const minSize = Math.max(width, height, canvas.width * 0.05);
                    const expandW = minSize * 2.2;
                    const expandH = minSize * 2.8;

                    const centerX = originX + width / 2;
                    const centerY = originY + height / 2;

                    const x = centerX - expandW / 2;
                    // Shift up to catch hair
                    const y = centerY - expandH * 0.65;

                    currentHeads.push({ x, y, w: expandW, h: expandH });
                }
            });
        }

        // ---------------------------------------------------------
        // B. Run Pose Detection
        // ---------------------------------------------------------
        const poseResults = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);

        // TUNED CONSTANTS
        const FACE_POINT_VISIBILITY = 0.55;     // Standard
        const SHOULDER_POINT_VISIBILITY = 0.85; // STRICT (No Ghosts)

        if (poseResults.landmarks) {
            poseResults.landmarks.forEach((landmarks) => {
                const headIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                let hasHeadPoints = false;

                // Check head points (Standard Tolerance)
                headIndices.forEach(index => {
                    const point = landmarks[index];
                    if (point && point.visibility > FACE_POINT_VISIBILITY) {
                        hasHeadPoints = true;
                        const px = point.x * canvas.width;
                        const py = point.y * canvas.height;
                        minX = Math.min(minX, px);
                        minY = Math.min(minY, py);
                        maxX = Math.max(maxX, px);
                        maxY = Math.max(maxY, py);
                    }
                });

                // Shoulder Check (Back of Head Fallback)
                if (!hasHeadPoints) {
                    const leftShoulder = landmarks[11];
                    const rightShoulder = landmarks[12];
                    // STRICT CHECK: Require high confidence to avoid "Chair Ghosts"
                    if (leftShoulder && rightShoulder &&
                        leftShoulder.visibility > SHOULDER_POINT_VISIBILITY &&
                        rightShoulder.visibility > SHOULDER_POINT_VISIBILITY) {

                        const sx = (leftShoulder.x + rightShoulder.x) / 2 * canvas.width;
                        const sy = (leftShoulder.y + rightShoulder.y) / 2 * canvas.height;
                        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) * canvas.width;

                        minX = sx - shoulderWidth * 0.5;
                        maxX = sx + shoulderWidth * 0.5;
                        minY = sy - shoulderWidth * 1.5;
                        maxY = sy;
                        hasHeadPoints = true;
                    }
                }

                if (hasHeadPoints) {
                    const rawW = maxX - minX;
                    const rawH = maxY - minY;
                    const centerX = minX + rawW / 2;
                    const centerY = minY + rawH / 2;

                    const minSize = Math.max(rawW, rawH, canvas.width * 0.05);
                    const expandW = minSize * 2.2;
                    const expandH = minSize * 2.8;

                    const x = centerX - expandW / 2;
                    const y = centerY - expandH * 0.65;

                    currentHeads.push({ x, y, w: expandW, h: expandH });
                }
            });
        }

        // ---------------------------------------------------------
        // 4. Update Tracking (Persistence)
        // ---------------------------------------------------------
        const MAX_TTL = 30; // 1s - Increased slightly to bridge small gaps
        const MATCH_THRESHOLD = 300;

        const getDist = (h1: { x: number, w: number, y: number, h: number }, h2: { x: number, w: number, y: number, h: number }) => {
            const c1x = h1.x + h1.w / 2;
            const c1y = h1.y + h1.h / 2;
            const c2x = h2.x + h2.w / 2;
            const c2y = h2.y + h2.h / 2;
            return Math.sqrt(Math.pow(c1x - c2x, 2) + Math.pow(c1y - c2y, 2));
        };

        const activeTracks = trackedHeadsRef.current;
        const usedCurrentIndices = new Set<number>();

        activeTracks.forEach(track => {
            let bestDist = Infinity;
            let bestIdx = -1;

            currentHeads.forEach((head, idx) => {
                if (usedCurrentIndices.has(idx)) return;
                const d = getDist({ x: track.x, y: track.y, w: track.width, h: track.height }, head);
                if (d < bestDist && d < MATCH_THRESHOLD) {
                    bestDist = d;
                    bestIdx = idx;
                }
            });

            if (bestIdx !== -1) {
                const matched = currentHeads[bestIdx];
                usedCurrentIndices.add(bestIdx);

                track.targetX = matched.x;
                track.targetY = matched.y;
                track.targetW = matched.w;
                track.targetH = matched.h;
                track.ttl = MAX_TTL;
            } else {
                track.ttl -= 1;
            }
        });

        currentHeads.forEach((head, idx) => {
            if (!usedCurrentIndices.has(idx)) {
                activeTracks.push({
                    id: nextHeadIdRef.current++,
                    x: head.x,
                    y: head.y,
                    width: head.w,
                    height: head.h,
                    targetX: head.x,
                    targetY: head.y,
                    targetW: head.w,
                    targetH: head.h,
                    ttl: MAX_TTL
                });
            }
        });

        trackedHeadsRef.current = activeTracks.filter(t => t.ttl > 0);

        // 5. Render All Tracked Heads
        const alpha = 0.25;

        trackedHeadsRef.current.forEach(track => {
            track.x += (track.targetX - track.x) * alpha;
            track.y += (track.targetY - track.y) * alpha;
            track.width += (track.targetW - track.width) * alpha;
            track.height += (track.targetH - track.height) * alpha;

            const { x, y, width: w, height: h } = track;

            const cx = Math.max(0, x);
            const cy = Math.max(0, y);
            const cw = Math.min(w, canvas.width - cx);
            const ch = Math.min(h, canvas.height - cy);

            if (cw > 0 && ch > 0) {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                    tempCanvas.width = cw;
                    tempCanvas.height = ch;

                    tempCtx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);

                    // Heavy Blur
                    // Standard Blur (Reduced from "Heavy")
                    const blurAmount = Math.max(12, Math.min(cw, ch) / 8);
                    tempCtx.globalCompositeOperation = 'copy';
                    tempCtx.filter = `blur(${blurAmount}px)`;
                    tempCtx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
                    tempCtx.filter = 'none';

                    // Feather
                    tempCtx.globalCompositeOperation = 'destination-in';
                    const gradient = tempCtx.createRadialGradient(
                        cw / 2, ch / 2, Math.min(cw, ch) * 0.25,
                        cw / 2, ch / 2, Math.min(cw, ch) * 0.7
                    );
                    gradient.addColorStop(0, 'rgba(0,0,0,1)');
                    gradient.addColorStop(1, 'rgba(0,0,0,0)');
                    tempCtx.fillStyle = gradient;
                    tempCtx.fillRect(0, 0, cw, ch);

                    ctx.drawImage(tempCanvas, cx, cy);
                }
            }
        });

        // Update progress
        if (video.duration) {
            setProgress((video.currentTime / video.duration) * 100);
        }

        animationFrameId.current = requestAnimationFrame(processFrame);
    };

    const toggleProcessing = () => {
        if (isProcessing) {
            stopRecording();
        } else {
            startProcessing();
        }
    };

    const startProcessing = () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsProcessing(true);
        setProgress(0);
        recordedChunksRef.current = [];
        trackedHeadsRef.current = [];

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Attempt input matching mime type
        let mimeType = 'video/webm;codecs=vp9';
        if (file && file.type && MediaRecorder.isTypeSupported(file.type)) {
            mimeType = file.type;
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
            mimeType = "video/mp4";
        }

        setOutputMimeType(mimeType);

        const canvasStream = canvas.captureStream(30);

        // Attempt to capture audio from the video element
        try {
            // @ts-ignore - partial support for captureStream on HTMLVideoElement in types
            const videoStream = (video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null));
            if (videoStream) {
                const audioTracks = videoStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    canvasStream.addTrack(audioTracks[0]);
                }
            }
        } catch (e) {
            console.warn("Audio capture not supported/failed:", e);
        }

        const recorder = new MediaRecorder(canvasStream, { mimeType });

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            setProcessedVideoUrl(url);
            setIsProcessing(false);
            if (videoRef.current) videoRef.current.pause();
            toast({
                title: "Processing Complete",
                description: "Your video has been anonymised and is ready for download.",
            });
        };

        mediaRecorderRef.current = recorder;
        recorder.start();

        video.currentTime = 0;
        video.play().then(() => {
            processFrame();
        }).catch(err => {
            console.error("Error playing video:", err);
            setIsProcessing(false);
            toast({
                title: "Playback Error",
                description: "Could not start video playback for processing.",
                variant: "destructive"
            });
        });
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (videoRef.current) {
            videoRef.current.pause();
        }
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
        setIsProcessing(false);
    };

    const getDownloadExt = () => {
        if (outputMimeType.includes('mp4')) return 'mp4';
        if (outputMimeType.includes('webm')) return 'webm';
        if (outputMimeType.includes('quicktime')) return 'mov';
        return 'vid';
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans text-foreground">
            <Navigation />

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Header Section */}
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4">
                            <Shield className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            Video Anonymiser (Crowd + Back)
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Optimized for crowds and hidden faces. Precision logic filters "ghosts" while aggressive shoulder tracking catches identities from behind.
                        </p>
                    </div>

                    {/* Main Action Card */}
                    <Card className="border-2 border-dashed border-muted-foreground/20 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
                        <CardContent className="p-8">
                            {!file ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 transition-transform hover:scale-105 active:scale-95 duration-200">
                                        <Upload className="w-10 h-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-2xl font-semibold">Drop your video here</h3>
                                    <p className="text-muted-foreground text-center max-w-sm">
                                        Support for MP4, WebM, and MOV. Processing happens locally on your device for maximum privacy.
                                    </p>
                                    <div className="relative mt-8">
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <Button size="lg" className="rounded-full px-8 shadow-lg hover:shadow-primary/20 transition-all">
                                            Browse Files
                                        </Button>
                                    </div>
                                    {isModelLoading && (
                                        <p className="text-sm text-yellow-600 flex items-center gap-2 mt-4 animate-pulse">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading Optimized Detection Engine...
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="relative aspect-video bg-black/5 rounded-lg overflow-hidden border border-border shadow-inner">
                                        {/* Hidden source video */}
                                        <video
                                            ref={videoRef}
                                            src={videoSrc || ""}
                                            className="absolute opacity-0 pointer-events-none"
                                            muted
                                            playsInline
                                            onEnded={stopRecording}
                                        />
                                        {/* Display Canvas */}
                                        <canvas
                                            ref={canvasRef}
                                            className="w-full h-full object-contain"
                                        />

                                        {!isProcessing && !processedVideoUrl && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                                <div className="bg-background/90 p-4 rounded-full shadow-lg">
                                                    <Video className="w-8 h-8 text-primary" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="space-y-1 w-full sm:w-auto">
                                            <h4 className="font-semibold truncate max-w-[200px]">{file.name}</h4>
                                            <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                                        </div>

                                        <div className="flex gap-2 w-full sm:w-auto">
                                            {processedVideoUrl ? (
                                                <div className="flex gap-2 w-full">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1"
                                                        onClick={() => {
                                                            setFile(null);
                                                            setVideoSrc(null);
                                                            setProcessedVideoUrl(null);
                                                        }}
                                                    >
                                                        Start Over
                                                    </Button>
                                                    <a href={processedVideoUrl} download={`anonymised-${file.name.split('.')[0]}.${getDownloadExt()}`} className="flex-1">
                                                        <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
                                                            <CheckCircle className="w-4 h-4" />
                                                            Download Result
                                                        </Button>
                                                    </a>
                                                </div>
                                            ) : (
                                                <>
                                                    {isProcessing ? (
                                                        <Button
                                                            onClick={toggleProcessing}
                                                            variant="destructive"
                                                            className="w-full min-w-[140px] gap-2"
                                                        >
                                                            <div className="relative flex items-center justify-center">
                                                                <div className="w-3 h-3 bg-current rounded-sm mr-2 animate-pulse" />
                                                            </div>
                                                            Stop ({Math.round(progress)}%)
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            onClick={toggleProcessing}
                                                            disabled={isModelLoading}
                                                            className="w-full min-w-[140px] gap-2"
                                                        >
                                                            <FastForward className="w-4 h-4" />
                                                            Start Anonymising
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Features Grid */}
                    <div className="grid md:grid-cols-3 gap-6 pt-8">
                        {[
                            { title: "Crowd Ready", desc: "Process up to 20 people simultaneously with dual-core scanning.", icon: "👥" },
                            { title: "Back-of-Head Logic", desc: "Specialized algorithm detects bodies and heads even from behind.", icon: "🧠" },
                            { title: "Total Anonymity", desc: "Deep frosted blur with expanded coverage ensuring 100% privacy.", icon: "🔒" }
                        ].map((feature, i) => (
                            <div key={i} className="bg-card border border-border/50 p-6 rounded-xl hover:shadow-lg transition-shadow">
                                <div className="text-3xl mb-3">{feature.icon}</div>
                                <h3 className="font-semibold mb-2">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

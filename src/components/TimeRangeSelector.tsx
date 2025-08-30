import React, { useState, useEffect, useRef } from "react";
import {
  formatTime,
  parseTimeToSeconds,
  isValidTimeFormat,
} from "../utils/timeUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Download, X, Loader2 } from "lucide-react";

interface TimeRangeSelectorProps {
  videoDuration: number; // in seconds
  onTimeRangeChange: (startTime: number, endTime: number) => void;
  onCancel: () => void;
  videoTitle?: string;
  inline?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
  onCancelDownload?: () => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  videoDuration,
  onTimeRangeChange,
  onCancel,
  videoTitle,
  inline = false,
  isDownloading = false,
  downloadProgress = 0,
  onCancelDownload,
}) => {
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState(formatTime(videoDuration));
  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(videoDuration);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    setEndTime(formatTime(videoDuration));
    setEndSeconds(videoDuration);
  }, [videoDuration]);

  // Handle mouse events for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newSeconds = Math.round(percentage * videoDuration);

      if (isDragging === "start") {
        const clampedSeconds = Math.max(
          0,
          Math.min(newSeconds, endSeconds - 1)
        );
        setStartSeconds(clampedSeconds);
        setStartTime(formatTime(clampedSeconds));
        setStartError("");
      } else if (isDragging === "end") {
        const clampedSeconds = Math.max(
          startSeconds + 1,
          Math.min(newSeconds, videoDuration)
        );
        setEndSeconds(clampedSeconds);
        setEndTime(formatTime(clampedSeconds));
        setEndError("");
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDragging, videoDuration, startSeconds, endSeconds]);

  const handleStartDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging("start");
  };

  const handleEndDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging("end");
  };

  const handleSliderClick = (e: React.MouseEvent) => {
    if (!sliderRef.current || isDragging) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const clickedSeconds = Math.round(percentage * videoDuration);

    // Determine which handle is closer and move that one
    const distanceToStart = Math.abs(clickedSeconds - startSeconds);
    const distanceToEnd = Math.abs(clickedSeconds - endSeconds);

    if (distanceToStart < distanceToEnd) {
      const clampedSeconds = Math.max(
        0,
        Math.min(clickedSeconds, endSeconds - 1)
      );
      setStartSeconds(clampedSeconds);
      setStartTime(formatTime(clampedSeconds));
      setStartError("");
    } else {
      const clampedSeconds = Math.max(
        startSeconds + 1,
        Math.min(clickedSeconds, videoDuration)
      );
      setEndSeconds(clampedSeconds);
      setEndTime(formatTime(clampedSeconds));
      setEndError("");
    }
  };

  const validateAndSetStartTime = (value: string) => {
    setStartTime(value);
    setStartError("");

    if (!value.trim()) {
      setStartError("Start time is required");
      return;
    }

    if (!isValidTimeFormat(value)) {
      setStartError("Invalid time format. Use MM:SS or HH:MM:SS");
      return;
    }

    const startSec = parseTimeToSeconds(value);
    const endSec = parseTimeToSeconds(endTime);

    if (startSec >= endSec) {
      setStartError("Start time must be before end time");
      return;
    }

    if (startSec >= videoDuration) {
      setStartError("Start time cannot exceed video duration");
      return;
    }

    setStartSeconds(startSec);
  };

  const validateAndSetEndTime = (value: string) => {
    setEndTime(value);
    setEndError("");

    if (!value.trim()) {
      setEndError("End time is required");
      return;
    }

    if (!isValidTimeFormat(value)) {
      setEndError("Invalid time format. Use MM:SS or HH:MM:SS");
      return;
    }

    const endSec = parseTimeToSeconds(value);
    const startSec = parseTimeToSeconds(startTime);

    if (endSec <= startSec) {
      setEndError("End time must be after start time");
      return;
    }

    if (endSec > videoDuration) {
      setEndError("End time cannot exceed video duration");
      return;
    }

    setEndSeconds(endSec);
  };

  const handleConfirm = () => {
    onTimeRangeChange(startSeconds, endSeconds);
  };

  const isValid =
    !startError &&
    !endError &&
    isValidTimeFormat(startTime) &&
    isValidTimeFormat(endTime) &&
    parseTimeToSeconds(startTime) < parseTimeToSeconds(endTime) &&
    parseTimeToSeconds(endTime) <= videoDuration;

  // Inline version for embedding in MediaGrid
  if (inline) {
    return (
      <div className="space-y-4 p-4 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm border border-border/50 rounded-lg">
        {videoTitle && (
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-blue-500/20 text-blue-400 border-blue-500/30"
            >
              <Clock className="w-3 h-3 mr-1" />
              Video
            </Badge>
            <h4
              className="text-sm font-medium text-foreground truncate"
              title={videoTitle}
            >
              {videoTitle}
            </h4>
          </div>
        )}

        <div className="text-sm text-muted-foreground font-medium">
          Duration: {formatTime(videoDuration)}
        </div>

        {/* Visual Range Slider */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Select Time Range
          </div>
          <div className="relative">
            {/* Timeline background */}
            <div
              ref={sliderRef}
              className="h-8 bg-muted/30 cursor-pointer relative overflow-hidden "
              onClick={handleSliderClick}
            >
              {/* Selected range */}
              <div
                className="absolute h-full bg-gradient-to-r from-primary to-destructive pointer-events-none"
                style={{
                  left: `${(startSeconds / videoDuration) * 100}%`,
                  width: `${
                    ((endSeconds - startSeconds) / videoDuration) * 100
                  }%`,
                }}
              />

              {/* Start handle */}
              <div
                className={`absolute top-1/2 transform -translate-y-1/2 w-2 h-full bg-foreground border-r-2 border-background shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 ${
                  isDragging === "start" ? "scale-125" : ""
                }`}
                style={{
                  left: `${(startSeconds / videoDuration) * 100}%`,
                  marginLeft: "0px",
                }}
                onMouseDown={handleStartDrag}
              />

              {/* End handle */}
              <div
                className={`absolute top-1/2 transform -translate-y-1/2 w-2 h-full bg-foreground border-l-2 border-background shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 ${
                  isDragging === "end" ? "scale-125" : ""
                }`}
                style={{
                  left: `${(endSeconds / videoDuration) * 100}%`,
                  marginLeft: "-8px",
                }}
                onMouseDown={handleEndDrag}
              />
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0:00</span>
              <span>{formatTime(videoDuration)}</span>
            </div>

            {/* Selected time display */}
            <div className="text-center text-sm text-foreground mt-2 font-medium">
              Selected: {formatTime(startSeconds)} - {formatTime(endSeconds)}
              <span className="text-muted-foreground ml-1">
                ({formatTime(endSeconds - startSeconds)})
              </span>
            </div>
          </div>
        </div>

        {/* Time Input Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Start Time
            </label>
            <input
              type="text"
              value={startTime}
              onChange={(e) => validateAndSetStartTime(e.target.value)}
              placeholder="00:00 or 00:00:00"
              className={`w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                startError
                  ? "border-destructive focus:ring-destructive/20"
                  : "border-border focus:ring-primary/20 focus:border-primary"
              }`}
            />
            {startError && (
              <p className="text-destructive text-xs mt-1">{startError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              End Time
            </label>
            <input
              type="text"
              value={endTime}
              onChange={(e) => validateAndSetEndTime(e.target.value)}
              placeholder="00:00 or 00:00:00"
              className={`w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                endError
                  ? "border-destructive focus:ring-destructive/20"
                  : "border-border focus:ring-primary/20 focus:border-primary"
              }`}
            />
            {endError && (
              <p className="text-destructive text-xs mt-1">{endError}</p>
            )}
          </div>
        </div>

        {/* Download Progress */}
        {isDownloading && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20 backdrop-blur-sm">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Downloading segment...
              </span>
              <span className="font-semibold text-foreground">
                {Math.round(downloadProgress)}%
              </span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {isDownloading ? (
            <Button
              onClick={onCancelDownload}
              variant="destructive"
              size="sm"
              className="min-w-[140px] flex-1 transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg font-semibold"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={!isValid}
              size="sm"
              className={`min-w-[140px] flex-1 transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg font-semibold ${
                !isValid ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Download className="w-4 h-4" />
              Download Segment
            </Button>
          )}
        </div>
      </div>
    );
  }
};

export default TimeRangeSelector;

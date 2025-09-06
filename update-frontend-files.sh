#!/bin/bash

# Update frontend files on VPS
echo "Updating frontend files on VPS..."

# Copy the new build files to VPS
scp -r dist/* daniel@57.129.63.234:~/backend/public/ 2>/dev/null || {
    echo "Failed to copy files. Trying to create directory first..."
    ssh daniel@57.129.63.234 'mkdir -p ~/backend/public' 2>/dev/null
    scp -r dist/* daniel@57.129.63.234:~/backend/public/
}

echo "Frontend files updated successfully!"
echo "The tunnel should now serve the updated files."
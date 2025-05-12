import WebMWriter from 'webm-writer'; // Import the library

const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d');

// Splash Screen Elements
const splashScreen = document.getElementById('splash-screen');
const getStartedButton = document.getElementById('get-started-button');
const cancelStartupButton = document.getElementById('cancel-startup-button');
const appContainer = document.getElementById('app-container'); // Main app container
const frameTimelineContainer = document.getElementById('frame-timeline-container'); // Timeline container

const toolPanel = document.getElementById('tool-panel');
const frameTimeline = document.getElementById('frame-timeline');
const addFrameButton = document.getElementById('add-frame');
const deleteFrameButton = document.getElementById('delete-frame');
const duplicateFrameButton = document.getElementById('duplicate-frame');
const playAnimationButton = document.getElementById('play-animation');
const stopAnimationButton = document.getElementById('stop-animation');
const colorPicker = document.getElementById('color-picker');
const brushSizeSlider = document.getElementById('brush-size');
const onionSkinToggle = document.getElementById('onion-skin-toggle');
const onionSkinPrevInput = document.getElementById('onion-skin-prev');
const onionSkinNextInput = document.getElementById('onion-skin-next');
const onionSkinPrevOpacityInput = document.getElementById('onion-skin-prev-opacity');
const onionSkinNextOpacityInput = document.getElementById('onion-skin-next-opacity');
const fpsInput = document.getElementById('fps-input');
const loopAnimationToggle = document.getElementById('loop-animation');
// Updated: Select all tool buttons including the new fill tool
const toolButtons = document.querySelectorAll('.tool-button');

// Canvas Size Inputs and Button
const canvasWidthInput = document.getElementById('canvas-width');
const canvasHeightInput = document.getElementById('canvas-height');
const applyCanvasSizeButton = document.getElementById('apply-canvas-size');
// New: Preset Size Buttons
const presetSizeButtons = document.querySelectorAll('#tool-panel button[data-width][data-height]'); // Select buttons with data-width and data-height

// File Buttons
const exportAnimationButton = document.getElementById('export-animation'); // Export JSON
const exportVideoButton = document.getElementById('export-video'); // New: Export Video
const importAnimationButton = document.getElementById('import-animation');
const importFileInput = document.getElementById('import-file-input');
const exportFrameImageButton = document.getElementById('export-frame-image');

// New: Theme Selection Elements
const themeSelect = document.getElementById('theme-select');
const body = document.body; // Reference to the body for applying theme classes

// --- Audio State ---
let audioContext;
let startupSoundBuffer;

// --- State ---
let frames = []; // Array of frames. Each frame is an array of drawing actions.
let currentFrameIndex = 0;
let isDrawing = false;
let currentPath = []; // Points for the current stroke
let brushColor = colorPicker.value;
let brushSize = parseInt(brushSizeSlider.value);
let currentTool = 'pen'; // 'pen', 'eraser', 'fill', etc.

let animationInterval = null;
let onionSkinWasEnabledBeforePlay = false; // State to remember onion skin state before playback
let initialFrameIndexBeforePlayback = 0; // New: Store the frame index before playback starts

// Drag and Drop State for frames
let draggedItem = null; // DOM element being dragged
let draggedItemOriginalIndex = -1; // Original index of the dragged frame data

// --- Tutorial State ---
let tutorialActive = false;
let currentTutorialStep = 0;
const tutorialSteps = [
    {
        elementId: 'tool-panel',
        message: 'Welcome to Artstation! This is the Tool Panel. Here you can find all your drawing tools, color pickers, frame controls, and more!',
        position: 'right',
        highlight: true
    },
    {
        elementId: 'animation-canvas',
        message: 'This is the Canvas. Your animation will come to life here. When not in tutorial mode, click and drag to draw!',
        position: 'bottom',
        highlight: true
    },
    {
        elementId: 'tool-pen',
        message: 'Select the Pen tool to start drawing lines. You can also find Eraser and Fill Bucket tools here.',
        position: 'right',
        highlight: true
    },
    {
        elementId: 'color-picker',
        message: 'Choose your drawing color here.',
        position: 'right',
        highlight: true
    },
    {
        elementId: 'brush-size',
        message: 'Adjust your brush size with this slider.',
        position: 'right',
        highlight: true
    },
    {
        elementId: 'add-frame',
        message: 'Click "Add Frame" to create a new frame for your animation. You can also delete or duplicate frames.',
        position: 'top',
        highlight: true
    },
    {
        elementId: 'frame-timeline-container',
        message: 'The Frame Timeline at the bottom shows all your frames. Click on a frame thumbnail to select and edit it.',
        position: 'top',
        highlight: true
    },
    {
        elementId: 'play-animation',
        message: 'Once you have a few frames, click "Play" to see your animation! You can set FPS and looping options nearby.',
        position: 'top',
        highlight: true
    },
     {
        elementId: 'canvas-width', // Target width input for general area
        message: 'You can change the canvas size here. Presets are also available. Applying size will clear frames.',
        position: 'right',
        highlight: true // Highlight the whole "Canvas Size" section or just one input
    },
    {
        elementId: 'export-video', // Can also use 'export-animation' or a common parent
        message: 'When you are done, you can export your animation as a JSON file (to re-import later), a WebM video, or export the current frame as a PNG image.',
        position: 'top',
        highlight: true
    },
    {
        elementId: 'theme-select',
        message: 'Customize the look of the app by selecting a theme here! That\'s it for the basics. Happy animating!',
        position: 'top',
        highlight: true
    }
];
let tutorialPopup = null;

// --- Theme Management ---
function applyTheme(themeName) {
    // Remove previous theme classes
    body.classList.forEach(className => {
        if (className.startsWith('theme-')) {
            body.classList.remove(className);
        }
    });

    // Add the new theme class
    if (themeName !== 'default') {
        body.classList.add(`theme-${themeName}`);
    }

    // Store selected theme in localStorage
    localStorage.setItem('animationTheme', themeName);

    // Update theme select dropdown value
    themeSelect.value = themeName;

    // Re-render current frame to ensure UI elements drawn *outside* canvas but dependent on CSS vars are correct
    // Canvas content rendering itself doesn't change based on theme background anymore
    renderFrame();
    updateTimeline();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('animationTheme');
    // Check if the saved theme is a valid option in the dropdown
    const optionExists = Array.from(themeSelect.options).some(option => option.value === savedTheme);
    if (savedTheme && optionExists) {
        applyTheme(savedTheme);
    } else {
        applyTheme('default'); // Apply default theme if none saved or saved theme is invalid/missing
    }
}

// --- Helper Functions ---

// Helper to convert hex to RGBA array [r, g, b, a]
function hexToRGBA(hex, alpha = 1) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    // Ensure alpha is clamped between 0 and 1 before scaling to 0-255
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    return [r, g, b, Math.round(clampedAlpha * 255)];
}

// Flood fill implementation operating directly on a canvas context's imageData
// Takes context and fill parameters. Operates in the context's *current* coordinate space.
function floodFill(context, startX, startY, fillColor) {
    const width = context.canvas.width;
    const height = context.canvas.height;

    // Get pixel data from the context *at its current state*
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // Helper function to get pixel index
    function getPixelIndex(x, y) {
        // Ensure x and y are within bounds
        if (x < 0 || x >= width || y < 0 || y >= height) return -1;
        const pixelX = Math.round(x);
        const pixelY = Math.round(y);
        if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) return -1; // Re-check bounds after rounding
        return (pixelY * width + pixelX) * 4; // 4 bytes per pixel (r, g, b, a)
    }

    // Helper function to get pixel color [r, g, b, a]
    function getPixelColor(x, y) {
        const i = getPixelIndex(x, y);
        if (i === -1) return null; // Indicate out of bounds
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    }

    // Helper function to set pixel color [r, g, b, a]
    function setPixelColor(x, y, color) {
        const i = getPixelIndex(x, y);
        if (i === -1) return; // Do nothing if out of bounds
        pixels[i] = color[0];
        pixels[i + 1] = color[1];
        pixels[i + 2] = color[2];
        pixels[i + 3] = color[3]; // Alpha
    }

    // Helper function to check if two colors are the same (exact match for pixel art)
    function colorsMatch(color1, color2) {
        if (!color1 || !color2) return false; // Handle null/undefined colors
        // Check all components including alpha
        return color1[0] === color2[0] &&
            color1[1] === color2[1] &&
            color1[2] === color2[2] &&
            color1[3] === color2[3];
    }

    // --- Flood Fill Logic ---
    // Clamp start coordinates to be within bounds and round to nearest pixel
    // Rounding is important as fill operates on pixel grid
    const sx = Math.max(0, Math.min(width - 1, Math.round(startX)));
    const sy = Math.max(0, Math.min(height - 1, Math.round(startY)));

    // Get target color at the clamped starting point
    const targetColor = getPixelColor(sx, sy);
    // Convert fill color to RGBA with full opacity (alpha = 255)
    const fillRGBA = hexToRGBA(fillColor, 1); // Fill color should be fully opaque (alpha 1)

    // If target color is the same as fill color or target color is out of bounds, do nothing
    if (!targetColor || colorsMatch(targetColor, fillRGBA)) {
        return; // No fill needed
    }

    // Use a queue for BFS (Breadth-First Search)
    const queue = [[sx, sy]];
    // Use a Set for visited pixels (string key "x,y") - faster lookup than checking pixel data repeatedly
    const visited = new Set();
    visited.add(`${sx},${sy}`); // Add the starting point to visited

    // Directions for 4-directional fill (up, down, left, right)
    const dx = [0, 0, 1, -1];
    const dy = [-1, 1, 0, 0];

    while (queue.length > 0) {
        const [x, y] = queue.shift(); // Dequeue

        // Check if the current pixel is still the target color (important because queue can contain pixels already changed by neighbors)
        // Re-reading the color here is less efficient but more robust against race conditions in flood fill logic
        const currentColor = getPixelColor(x, y);
        if (!currentColor || !colorsMatch(currentColor, targetColor)) {
            continue; // Skip if pixel is already changed or out of bounds
        }

        // Set the color of the current pixel
        setPixelColor(x, y, fillRGBA);

        // Check neighbors
        for (let i = 0; i < 4; i++) {
            const nx = x + dx[i];
            const ny = y + dy[i];
            const neighborKey = `${nx},${ny}`;

            // Check bounds and if not visited
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(neighborKey)) {
                // Check if neighbor has the target color
                const neighborColor = getPixelColor(nx, ny);
                if (neighborColor && colorsMatch(neighborColor, targetColor)) {
                    visited.add(neighborKey); // Mark as visited
                    queue.push([nx, ny]); // Enqueue neighbor
                }
            }
        }
    }

    // After the BFS is complete and pixels are modified in the imageData,
    // update the canvas context with the changed pixel data.
    context.putImageData(imageData, 0, 0);
}

// --- Drawing Functions ---
function startDrawing(e) {
    // Add check: Only allow drawing if a frame exists and is selected
    if (!frames[currentFrameIndex]) {
        console.warn("Cannot start drawing: No active frame.");
        return;
    }

    const { offsetX, offsetY } = getCanvasCoords(e);

    // Handle different tools
    if (currentTool === 'pen' || currentTool === 'eraser') {
        isDrawing = true;
        currentPath = [[offsetX, offsetY]];

        // Immediately apply effect for the first point (temporary visual feedback)
        // Draw directly on the canvas context
        ctx.save(); // Save state before temporary drawing
        // Use 'white' for eraser even for temp drawing, matches how drawFrameContent does it
        const tempColor = currentTool === 'pen' ? brushColor : 'white';
        const tempSize = brushSize / 2; // Use half size for dot radius

        ctx.fillStyle = tempColor;
        ctx.beginPath();
        ctx.arc(offsetX, offsetY, tempSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore(); // Restore state

    } else if (currentTool === 'fill') {
        // Handle fill tool click
        // Add the fill action to the current frame's data
        const action = {
            type: 'fill', // New action type
            x: offsetX,
            y: offsetY,
            color: brushColor // Store the fill color
        };
        // Add the action to the current frame
        // Ensure the current frame exists before pushing
        if (frames[currentFrameIndex]) {
            frames[currentFrameIndex].push(action);
            // Re-render the canvas to apply the new fill action immediately
            renderFrame();
            // Update the timeline thumbnail as the frame content has changed
            updateTimeline();
        } else {
            console.error("Attempted to add fill action to non-existent frame.");
        }

        // Flood fill is a single click action, no need for mousemove/mouseup drawing state
    }
}

function draw(e) {
    // Only perform drawing logic for pen/eraser tools
    if (!isDrawing || (currentTool !== 'pen' && currentTool !== 'eraser')) return;

    const { offsetX, offsetY } = getCanvasCoords(e);

    // Temporarily draw on canvas for feedback
    // This temporary drawing happens *on top* of the rendered frame and onion skin.
    // It gets cleared when stopDrawing calls renderFrame.
    ctx.save(); // Save state before temporary drawing
    // Use 'white' for eraser even for temp drawing, matches how drawFrameContent does it
    const tempColor = currentTool === 'pen' ? brushColor : 'white';
    const tempSize = brushSize;

    currentPath.push([offsetX, offsetY]);

    ctx.strokeStyle = tempColor;
    ctx.lineWidth = tempSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    // Ensure there are at least two points to draw a line segment
    // Draw from the last point in the path to the current point
    if (currentPath.length >= 2) {
        const prevPoint = currentPath[currentPath.length - 2];
        const currentPoint = currentPath[currentPath.length - 1];
        ctx.moveTo(prevPoint[0], prevPoint[1]);
        ctx.lineTo(currentPoint[0], currentPoint[1]);
        ctx.stroke();
    } else if (currentPath.length === 1) {
        // If only one point, draw a dot for immediate feedback
         const currentPoint = currentPath[0];
         ctx.arc(currentPoint[0], currentPoint[1], tempSize / 2, 0, Math.PI * 2); // Use half size for radius
         ctx.fill(); // Fill for dots
    }
    ctx.restore(); // Restore state
}

function stopDrawing() {
    // Only perform stop drawing logic for pen/eraser tools
    if (!isDrawing || (currentTool !== 'pen' && currentTool !== 'eraser')) return;

    // Add check: Ensure the current frame still exists before pushing data
    if (!frames[currentFrameIndex]) {
        console.warn("Cannot save drawing: Active frame is missing.");
        isDrawing = false; // Reset drawing state
        currentPath = []; // Reset path
        renderFrame(); // Clean up potential temporary drawing
        return;
    }

    isDrawing = false;

    // Only save drawing action if currentPath has points
    if (currentPath.length > 0) {
        const action = {
            type: currentTool, // Save the tool type ('pen' or 'eraser')
            points: [...currentPath], // Store a copy
            size: brushSize
        };
        if (currentTool === 'pen') {
            action.color = brushColor; // Save color only for pen
        }
        frames[currentFrameIndex].push(action);
    }

    currentPath = []; // Reset path
    // After adding the stroke, re-render the frame to include onion skin if enabled and update thumbnail
    renderFrame();
    updateTimeline();
}

// Helper function to get canvas coordinates from an event
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; // Relationship bitmap vs. layout size
    const scaleY = canvas.height / rect.height; // Relationship bitmap vs. layout size

    return {
        offsetX: (e.clientX - rect.left) * scaleX,
        offsetY: (e.clientY - rect.top) * scaleY
    };
}

// --- Frame Management ---
function addFrame(copyCurrent = false) {
    // Ensure index is valid before attempting copy
    const sourceFrame = copyCurrent && currentFrameIndex >= 0 && currentFrameIndex < frames.length ? frames[currentFrameIndex] : null;
    // Deep copy the frame actions if copying - includes all action types (pen, eraser, fill)
    const newFrame = sourceFrame ? sourceFrame.map(action => {
        const newAction = { ...action };
        // Deep copy points array for pen/eraser actions if it exists and is an array
        if ((action.type === 'pen' || action.type === 'eraser') && Array.isArray(action.points)) {
            newAction.points = [...action.points];
        }
        // No deep copy needed for fill action (just coordinates and color)
        return newAction;
    }) : [];

    // If frames is empty and we're adding the first frame, just add it at index 0.
    // Otherwise, insert after the current frame.
    const insertIndex = frames.length === 0 ? 0 : currentFrameIndex + 1;
    frames.splice(insertIndex, 0, newFrame);
    currentFrameIndex = insertIndex; // Select the newly added frame
    renderFrame();
    updateTimeline();
}

function deleteFrame() {
    if (frames.length <= 1) return; // Cannot delete the last frame
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        console.warn("Cannot delete: No valid frame selected.");
        return;
    }

    frames.splice(currentFrameIndex, 1);
    // Adjust index if the last frame was deleted
    if (currentFrameIndex >= frames.length) {
        currentFrameIndex = frames.length - 1;
    }
    // Ensure index is not negative if frames were deleted (shouldn't happen if frames.length > 0 after check)
    if (currentFrameIndex < 0) {
        currentFrameIndex = 0; // Should only happen if frames was empty initially, which is prevented
    }

    renderFrame(); // Render the new current frame
    updateTimeline();
}

function duplicateFrame() {
    if (frames.length === 0) return; // Cannot duplicate if no frames exist
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        console.warn("Cannot duplicate: No valid frame selected.");
        return;
    }
    // Call addFrame with copyCurrent = true to duplicate the current frame's content
    addFrame(true);
}

function selectFrame(index) {
    // Check if index is valid
    if (index < 0 || index >= frames.length) {
        console.warn("Attempted to select invalid frame index:", index);
        // If frames exist, select the closest valid index
        if (frames.length > 0) {
            currentFrameIndex = Math.max(0, Math.min(index, frames.length - 1));
        } else {
            currentFrameIndex = -1; // No frames selected
        }
        // If no frames, clear canvas and timeline
        if (frames.length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Add background back after clearing - now always white
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            frameTimeline.innerHTML = '';
        } else {
            // If index was invalid but frames exist, render the newly clamped index
            renderFrame();
            updateTimeline();
        }
        return;
    }
    // If index is valid and different from current, update
    if (index !== currentFrameIndex) {
        currentFrameIndex = index;
        renderFrame();
        updateTimeline();
    } else {
        // If selected index is the same, just ensure it's rendered and timeline updated
        renderFrame();
        updateTimeline();
    }
}

function updateTimeline() {
    frameTimeline.innerHTML = ''; // Clear timeline
    frames.forEach((frame, index) => {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.classList.add('frame-thumbnail');
        if (index === currentFrameIndex) {
            thumbnailDiv.classList.add('active');
        }
        thumbnailDiv.dataset.index = index;
        thumbnailDiv.setAttribute('draggable', 'true'); // Make draggable

        const frameNumberSpan = document.createElement('span');
        frameNumberSpan.textContent = index + 1;
        thumbnailDiv.appendChild(frameNumberSpan);

        // Create a small canvas for the preview
        const thumbCanvas = document.createElement('canvas');
        // Match main canvas aspect ratio, but keep thumbnail size reasonable
        const thumbSize = 70; // px
        // Calculate aspect ratio safely
        const aspectRatio = canvas.height <= 0 ? 1 : canvas.width / canvas.height; // Handle height 0 case
        thumbCanvas.width = thumbSize;
        // Ensure calculated height is positive
        thumbCanvas.height = Math.max(1, Math.round(thumbSize / aspectRatio)); // Round height to nearest pixel


        const thumbCtx = thumbCanvas.getContext('2d');

        // *** Modified: Clear and add white background here before drawing frame content ***
        thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbCtx.fillStyle = 'white'; // Always white background for thumbnail canvas
        thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);


        // Scale content to fit thumbnail canvas while preserving aspect ratio
        // Ensure canvas dimensions are positive before calculating scale
        const scaleX = canvas.width > 0 ? thumbCanvas.width / canvas.width : 0;
        const scaleY = canvas.height > 0 ? thumbCanvas.height / canvas.height : 0;
        // Handle cases where width or height is 0 by setting scale to 0
        const scale = (canvas.width > 0 && canvas.height > 0) ? Math.min(scaleX, scaleY) : 0;

        const scaledWidth = canvas.width * scale;
        const scaledHeight = canvas.height * scale;
        const xOffset = (thumbCanvas.width - scaledWidth) / 2;
        const yOffset = (thumbCanvas.height - scaledHeight) / 2;

        // Draw the frame onto the thumbnail canvas with scaling
        thumbCtx.save();
        thumbCtx.translate(xOffset, yOffset);
        thumbCtx.scale(scale, scale);
        // Draw frame content without onion skin specific tinting or opacity
        // Pass 'white' canvasBg for eraser actions reference in drawFrameContent
        drawFrameContent(thumbCtx, frames[index], { opacity: 1, canvasBg: 'white' });
        thumbCtx.restore();

        thumbnailDiv.appendChild(thumbCanvas);

        thumbnailDiv.addEventListener('click', () => selectFrame(index));
        
        // Drag and Drop Event Listeners for thumbnails
        thumbnailDiv.addEventListener('dragstart', (event) => {
            if (animationInterval !== null) { // Prevent dragging if animation is playing
                event.preventDefault();
                return;
            }
            draggedItem = event.target.closest('.frame-thumbnail');
            if (!draggedItem) return; // Should not happen if event is on thumbnailDiv
            draggedItemOriginalIndex = parseInt(draggedItem.dataset.index);
            
            event.dataTransfer.setData('text/plain', draggedItemOriginalIndex.toString());
            event.dataTransfer.effectAllowed = 'move';
            
            setTimeout(() => { // Delay adding class for drag image
                if (draggedItem) draggedItem.classList.add('dragging');
            }, 0);
        });

        thumbnailDiv.addEventListener('dragend', () => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
            }
            // Clear all drag-over indicators from all thumbnails
            document.querySelectorAll('.frame-thumbnail.drag-over-before, .frame-thumbnail.drag-over-after').forEach(el => {
                el.classList.remove('drag-over-before', 'drag-over-after');
            });
            draggedItem = null;
            draggedItemOriginalIndex = -1;
        });

        thumbnailDiv.addEventListener('dragover', (event) => {
            event.preventDefault(); 
            if (!draggedItem) return; 
            
            const targetOver = event.target.closest('.frame-thumbnail');

            // Clear all indicators first, except on the current target if it's already set
            document.querySelectorAll('.frame-thumbnail').forEach(thumb => {
                if (thumb !== targetOver) { 
                    thumb.classList.remove('drag-over-before', 'drag-over-after');
                }
            });

            if (targetOver && targetOver !== draggedItem) { 
                event.dataTransfer.dropEffect = 'move';
                const rect = targetOver.getBoundingClientRect();
                const offsetX = event.clientX - rect.left;
                if (offsetX < rect.width / 2) {
                    targetOver.classList.add('drag-over-before');
                    targetOver.classList.remove('drag-over-after');
                } else {
                    targetOver.classList.add('drag-over-after');
                    targetOver.classList.remove('drag-over-before');
                }
            } else if (targetOver && targetOver === draggedItem) {
                // If dragging over the item being dragged, remove its own indicators
                targetOver.classList.remove('drag-over-before', 'drag-over-after');
            }
        });
        
        thumbnailDiv.addEventListener('dragleave', (event) => {
            const currentTarget = event.currentTarget; 
            // Check if the mouse has truly left the element and its children
            if (!currentTarget.contains(event.relatedTarget) || event.relatedTarget === null) {
                 currentTarget.classList.remove('drag-over-before', 'drag-over-after');
            }
        });

        thumbnailDiv.addEventListener('drop', (event) => {
            event.preventDefault();
            if (!draggedItem) return;

            const targetThumbnail = event.target.closest('.frame-thumbnail');
            
            // Clean up visual state immediately
            if (draggedItem) draggedItem.classList.remove('dragging');
            document.querySelectorAll('.frame-thumbnail.drag-over-before, .frame-thumbnail.drag-over-after').forEach(el => {
                el.classList.remove('drag-over-before', 'drag-over-after');
            });

            if (!targetThumbnail || targetThumbnail === draggedItem || draggedItemOriginalIndex < 0) {
                // Invalid drop target or dropping on itself without moving, or invalid drag start
                draggedItem = null;
                draggedItemOriginalIndex = -1;
                return;
            }

            const fromIndex = draggedItemOriginalIndex;
            let toIndexOriginal = parseInt(targetThumbnail.dataset.index);

            const frameToMove = frames[fromIndex];

            // Remove frame from old position
            frames.splice(fromIndex, 1);

            // Adjust target index if source was before target in the array
            let adjustedTargetIndex = toIndexOriginal;
            if (fromIndex < toIndexOriginal) {
                adjustedTargetIndex--;
            }
            
            // Determine final insertion index based on drop position (before/after target)
            const rect = targetThumbnail.getBoundingClientRect();
            const isDroppingBeforeTarget = event.clientX - rect.left < rect.width / 2;
            
            let finalInsertIndex;
            if (isDroppingBeforeTarget) {
                finalInsertIndex = adjustedTargetIndex;
            } else {
                finalInsertIndex = adjustedTargetIndex + 1;
            }
            
            // Ensure index is within bounds (frames.length is now one less than original)
            finalInsertIndex = Math.max(0, Math.min(finalInsertIndex, frames.length));

            frames.splice(finalInsertIndex, 0, frameToMove);
            
            currentFrameIndex = finalInsertIndex; // Select the moved frame
            
            selectFrame(currentFrameIndex); // Re-render timeline and canvas

            // Reset drag state
            draggedItem = null;
            draggedItemOriginalIndex = -1;
        });
        
        frameTimeline.appendChild(thumbnailDiv);
    });

    // Scroll timeline to show the active frame
    const activeThumbnail = frameTimeline.querySelector('.frame-thumbnail.active');
    if (activeThumbnail) {
        activeThumbnail.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest'
        });
    }
}

// Helper function to draw the content (strokes/points/fills) of a single frame onto a given context
// This function *only* draws the content, it does *not* clear the context or add the background.
// The caller is responsible for setting up the context (clearing, background, transforms, globalAlpha).
function drawFrameContent(context, frame, options = {}) {
    if (!frame) return; // Don't draw if frame is null/undefined

    // Default options
    const effectiveOptions = {
        colorTint: null, // Apply tint to pen strokes
        opacity: 1, // Apply global opacity to the entire frame layer
        canvasBg: 'white' // Reference color for eraser/fill if needed - currently hardcoded to white
    };
    // Merge options with defaults, ensuring we don't merge undefined properties
    const mergedOptions = {};
    for (const key in effectiveOptions) {
        mergedOptions[key] = options[key] !== undefined ? options[key] : effectiveOptions[key];
    }
    const { colorTint, opacity, canvasBg } = mergedOptions;

    // Apply the requested opacity to the entire frame layer
    context.save(); // Save the context state before applying global alpha and drawing content
    context.globalAlpha = opacity;

    frame.forEach(action => {
        if (action.type === 'fill') {
            // For a fill action, apply the flood fill to the current state of the context.
            // Pass the coordinates directly. The context's current transform will handle scaling.
            floodFill(context, action.x, action.y, action.color);

        } else if (action.type === 'pen' || action.type === 'eraser') {
            // For pen/eraser strokes, draw them on top of any fills applied so far in this frame.
            if (action.points && action.points.length > 0) { // Add check for points array
                // For 'pen', use action color or tint. For 'eraser', draw the background color regardless of tint.
                // Use the canvasBg passed in options, which is always 'white' for the main canvas/thumbnails.
                const strokeStyle = action.type === 'eraser' ? canvasBg : (colorTint ? colorTint : action.color);
                const fillStyle = action.type === 'eraser' ? canvasBg : (colorTint ? colorTint : action.color); // Use fill style for dots

                context.strokeStyle = strokeStyle;
                context.fillStyle = fillStyle;
                context.lineWidth = action.size;
                context.lineCap = 'round';
                context.lineJoin = 'round';

                context.beginPath();
                // If it's just a single point, draw a circle
                if (action.points.length === 1) {
                    // Ensure action.points[0] exists
                    if (action.points[0]) {
                        context.arc(action.points[0][0], action.points[0][1], action.size / 2, 0, Math.PI * 2);
                        context.fill(); // Fill for dots/erase points
                    }
                } else {
                    // Draw a line path
                    // Ensure action.points[0] exists
                    if (action.points[0]) {
                        context.moveTo(action.points[0][0], action.points[0][1]);
                        for (let i = 1; i < action.points.length; i++) {
                            // Ensure action.points[i] exists
                            if (action.points[i]) {
                                context.lineTo(action.points[i][0], action.points[i][1]);
                            }
                        }
                        context.stroke(); // Stroke for paths/erase strokes
                    }
                }
            }
        }
    });

    // Restore context state (removes globalAlpha etc.)
    context.restore();
}

// --- Rendering ---
function renderFrame() {
    // Render frame clears the main canvas and draws onion skin and the current frame.

    // *** Modified: Clear the main canvas and add the white background ONCE at the beginning ***
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white'; // Canvas background is always white
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const enableOnionSkin = onionSkinToggle.checked && animationInterval === null; // Only enable if toggle is checked AND NOT playing
    const prevCount = parseInt(onionSkinPrevInput.value) || 0; // Default to 0 if invalid
    const nextCount = parseInt(onionSkinNextInput.value) || 0; // Default to 0 if invalid
    const prevOpacity = parseFloat(onionSkinPrevOpacityInput.value) || 0.2; // Default
    const nextOpacity = parseFloat(onionSkinNextOpacityInput.value) || 0.2; // Default

    // Draw previous frames (onion skin) *under* the current frame
    if (enableOnionSkin) {
        for (let i = prevCount; i >= 1; i--) { // Draw from furthest to closest
            const frameIndex = currentFrameIndex - i;
            if (frameIndex >= 0 && frames[frameIndex]) { // Add check for frame existence
                // Draw previous frame content with red tint and opacity
                // Pass 'white' as canvasBg reference for eraser
                drawFrameContent(ctx, frames[frameIndex], { colorTint: 'rgba(255, 0, 0, 0.5)', opacity: prevOpacity / (i * 0.5 + 1), canvasBg: 'white' }); // Reduce opacity slightly for further frames (modified formula)
            }
        }
    }

    // Draw next frames (onion skin) *under* the current frame
    if (enableOnionSkin) {
        for (let i = 1; i <= nextCount; i++) { // Draw from closest to furthest (visually matches previous)
            const frameIndex = currentFrameIndex + i;
            if (frameIndex < frames.length && frames[frameIndex]) { // Add check for frame existence
                // Draw next frame content with green tint and opacity
                // Pass 'white' as canvasBg reference for eraser
                drawFrameContent(ctx, frames[frameIndex], { colorTint: 'rgba(0, 255, 0, 0.5)', opacity: nextOpacity / (i * 0.5 + 1), canvasBg: 'white' }); // Reduce opacity slightly for further frames (modified formula)
            }
        }
    }

    // Draw current frame *on top* of onion skin layers
    if (currentFrameIndex >= 0 && currentFrameIndex < frames.length && frames[currentFrameIndex]) { // Add check for valid index and frame existence
        // Pass 'white' as canvasBg reference for eraser
        drawFrameContent(ctx, frames[currentFrameIndex], { opacity: 1, canvasBg: 'white' }); // Draw current frame fully opaque
    }
    // Note: The temporary drawing of the current path (for pen/eraser) is handled directly by the `draw` function on mousemove/touchmove,
    // drawing *on top* of whatever renderFrame has already drawn. It gets cleared on `stopDrawing` when `renderFrame` is called again
    // to draw the final state from the frame data without the temporary path.
}

// --- Animation Playback ---
function playAnimation() {
    // Added check: Don't play if canvas size inputs or file inputs are focused
    const activeElement = document.activeElement;
    const isControlFocused = activeElement === canvasWidthInput ||
        activeElement === canvasHeightInput ||
        activeElement === fpsInput || // Add fps input
        activeElement === onionSkinPrevInput || // Add onion skin inputs
        activeElement === onionSkinNextInput ||
        activeElement === onionSkinPrevOpacityInput ||
        activeElement === onionSkinNextOpacityInput ||
        activeElement === themeSelect || // Add theme select
        (activeElement.tagName === 'BUTTON' && activeElement.closest('#tool-panel')) || // Check if button is within the tool panel
        (activeElement.tagName === 'SELECT' && activeElement.closest('#tool-panel')) || // Check if select is within the tool panel
        (activeElement.tagName === 'INPUT' && activeElement.type === 'file'); // Check for file input

    if (isControlFocused) {
        console.log("Cannot play while controls are focused.");
        return; // Don't trigger playback if typing in inputs or interacting with controls
    }

    if (frames.length === 0 || animationInterval !== null) {
        console.log("Play conditions not met (no frames or already playing).");
        return;
    }

    // Cannot play animation if no valid frame is selected initially
    if (currentFrameIndex < 0) {
        console.warn("Cannot play animation: No frame selected.");
        return;
    }

    // Store the current frame index before starting
    initialFrameIndexBeforePlayback = currentFrameIndex;

    let frameIndex = currentFrameIndex; // Start from the current frame
    const fps = parseInt(fpsInput.value) || 12; // Default FPS
    const frameDuration = 1000 / fps;
    const loop = loopAnimationToggle.checked; // Get loop state

    animationInterval = setInterval(() => {
        // Update the current frame index for display purposes
        currentFrameIndex = frameIndex; // Update state BEFORE calling render/update
        renderFrame(); // Render the frame without selecting (avoids timeline scrolling during play)
        updateTimeline(); // Update timeline to highlight the active frame

        frameIndex++;

        if (frameIndex >= frames.length) {
            if (loop) {
                frameIndex = 0; // Loop back to the first frame
            } else {
                stopAnimation(); // Stop when the end is reached
            }
        }
    }, frameDuration);

    // Hide play button and show stop
    playAnimationButton.style.display = 'none';
    stopAnimationButton.style.display = 'inline-block';
    playAnimationButton.disabled = true; // Ensure play is disabled
    stopAnimationButton.disabled = false; // Ensure stop is enabled
}

function stopAnimation() {
    if (animationInterval === null) return; // Only stop if playing

    clearInterval(animationInterval);
    animationInterval = null;

    // Restore onion skin state
    onionSkinToggle.disabled = false; // Re-enable interaction
    onionSkinPrevInput.disabled = false;
    onionSkinNextInput.disabled = false;
    onionSkinPrevOpacityInput.disabled = false;
    onionSkinNextOpacityInput.disabled = false;
    onionSkinToggle.checked = onionSkinWasEnabledBeforePlay;
    // Re-enable loop toggle
    loopAnimationToggle.disabled = false;
    // Re-enable tool buttons
    toolButtons.forEach(button => button.disabled = false);
    // Re-enable frame control buttons
    addFrameButton.disabled = false;
    deleteFrameButton.disabled = false;
    duplicateFrameButton.disabled = false;
    // Re-enable canvas size inputs
    canvasWidthInput.disabled = false;
    canvasHeightInput.disabled = false;
    applyCanvasSizeButton.disabled = false;
    // Re-enable file buttons
    exportAnimationButton.disabled = false;
    exportVideoButton.disabled = false; // Re-enable video export
    importAnimationButton.disabled = false;
    // Re-enable preset size buttons
    presetSizeButtons.forEach(button => button.disabled = false);
    // Re-enable theme select
    themeSelect.disabled = false;
    // Re-enable FPS input
    fpsInput.disabled = false;

    // Return to the frame that was active before playback started
    // Use selectFrame to ensure UI is updated correctly
    selectFrame(initialFrameIndexBeforePlayback); // New

    // Restore play/stop button state
    playAnimationButton.style.display = 'inline-block';
    stopAnimationButton.style.display = 'none';
    playAnimationButton.disabled = false; // Ensure play is enabled
    stopAnimationButton.disabled = true; // Ensure stop is disabled
}

// --- File Operations ---
function exportAnimation() { // This is now Export JSON
    const animationData = {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        fps: parseInt(fpsInput.value) || 12,
        frames: frames
    };

    const dataString = JSON.stringify(animationData, null, 2); // Use null, 2 for pretty printing
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-animation.json'; // Suggest a file name and extension
    document.body.appendChild(a); // Append to body to make it clickable
    a.click(); // Trigger download
    document.body.removeChild(a); // Clean up
    URL.revokeObjectURL(url); // Free up the memory
}

async function exportVideo() {
    if (frames.length === 0) {
        alert("No frames to export!");
        return;
    }
    if (animationInterval !== null) {
        alert("Stop the animation before exporting!");
        return;
    }

    // Disable controls while processing
    exportVideoButton.disabled = true;
    exportVideoButton.textContent = 'Exporting...';
    playAnimationButton.disabled = true;
    stopAnimationButton.disabled = true;
    toolButtons.forEach(button => button.disabled = true);
    addFrameButton.disabled = true;
    deleteFrameButton.disabled = true;
    duplicateFrameButton.disabled = true;
    canvasWidthInput.disabled = true;
    canvasHeightInput.disabled = true;
    applyCanvasSizeButton.disabled = true;
    exportAnimationButton.disabled = true; // Disable JSON export
    importAnimationButton.disabled = true;
    exportFrameImageButton.disabled = true; // Disable Image export during video export
    presetSizeButtons.forEach(button => button.disabled = true);
    themeSelect.disabled = true;
    onionSkinToggle.disabled = true;
    onionSkinPrevInput.disabled = true;
    onionSkinNextInput.disabled = true;
    onionSkinPrevOpacityInput.disabled = true;
    onionSkinNextOpacityInput.disabled = true;
    loopAnimationToggle.disabled = true;
    fpsInput.disabled = true;

    const fps = parseInt(fpsInput.value) || 12;
    // WebMWriter needs duration per frame in milliseconds
    const frameDuration = 1000 / fps; // Duration of *each* frame in milliseconds

    // Create a temporary canvas to draw frames for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');

    // Configure WebMWriter
    const writer = new WebMWriter({
        // You can adjust video codec and quality here if needed
        codec: 'VP8',
        quality: 0.95,
        frameDuration: frameDuration // Specify frame duration
    });

    try {
        // Draw each frame onto the export canvas and add to writer
        for (let i = 0; i < frames.length; i++) {
            // Clear and add white background for each frame on the export canvas
            exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
            exportCtx.fillStyle = 'white'; // Always white background for video export
            exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

            // Draw frame content without onion skin tinting
            // Pass 'white' as canvasBg for the eraser
            drawFrameContent(exportCtx, frames[i], { opacity: 1, canvasBg: 'white' });

            // Add the frame from the export canvas
            // WebMWriter expects ImageBitmap or HTMLCanvasElement
            writer.addFrame(exportCanvas); // Duration is specified in the constructor

            // Optional: Update button text to show progress
            exportVideoButton.textContent = `Exporting frame ${i + 1}/${frames.length}...`;
        }

        // Optional: Add the last frame again to ensure it is displayed for its full duration
        // This is often done for playback smoothness at the end of the video.
        // Note: This adds an *extra* frame duration at the end.
        if (frames.length > 0) {
            // Redraw the last frame
            exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
            exportCtx.fillStyle = 'white'; // Use current background color
            exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            drawFrameContent(exportCtx, frames[frames.length - 1], { opacity: 1, canvasBg: 'white' });
             // We don't add an extra frame here, WebMWriter handles duration based on frameDuration config
             // Adding the last frame again is often useful if frameDuration is NOT used, but here it is.
             // Reverting the original change based on WebMWriter docs. The duration is fixed per frame.
        }

        exportVideoButton.textContent = `Finalizing video...`; // Update text for final step
        // Finalize the video
        const blob = await writer.complete();

        // Create a download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-animation.webm'; // Suggest a file name and .webm extension
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up

        alert("Video exported successfully!");

    } catch (error) {
        console.error("Error during video export:", error);
        alert("Failed to export video. Check the console for details.");
    } finally {
        // Re-enable controls
        exportVideoButton.disabled = false;
        exportVideoButton.textContent = 'Export as Video (WebM)';
        playAnimationButton.disabled = false; // Ensure play button is enabled
        // stopAnimationButton remains display: 'none' unless playing
        stopAnimationButton.disabled = true; // Ensure stop button is disabled when not playing

        // Clean up temporary canvas
        exportCanvas.remove();
        // Re-render the current frame on the main canvas just in case
        renderFrame();

        // Re-enable other controls
        toolButtons.forEach(button => button.disabled = false);
        addFrameButton.disabled = false;
        deleteFrameButton.disabled = false;
        duplicateFrameButton.disabled = false;
        canvasWidthInput.disabled = false;
        canvasHeightInput.disabled = false;
        applyCanvasSizeButton.disabled = false;
        exportAnimationButton.disabled = false; // Re-enable JSON export
        importAnimationButton.disabled = false;
        exportFrameImageButton.disabled = false; // Re-enable Image export
        presetSizeButtons.forEach(button => button.disabled = false);
        themeSelect.disabled = false;
        onionSkinToggle.disabled = false;
        onionSkinPrevInput.disabled = false;
        onionSkinNextInput.disabled = false;
        onionSkinPrevOpacityInput.disabled = false;
        onionSkinNextOpacityInput.disabled = false;
        loopAnimationToggle.disabled = false;
        fpsInput.disabled = false;
    }
}

function exportFrameAsImage() {
    // Check if a frame is currently selected
    if (currentFrameIndex < 0 || currentFrameIndex >= frames.length) {
        alert("No frame selected to export!");
        return;
    }

    // Disable button during export
    exportFrameImageButton.disabled = true;
    exportFrameImageButton.textContent = 'Exporting...';

    try {
        // Create a temporary canvas to draw the frame without onion skin
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext('2d');

        // Clear and add white background
        exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.fillStyle = 'white';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw the current frame content onto the temporary canvas
        // Ensure 'white' canvasBg is passed for eraser reference
        drawFrameContent(exportCtx, frames[currentFrameIndex], { opacity: 1, canvasBg: 'white' });

        // Get the image data as a Data URL
        const dataUrl = exportCanvas.toDataURL('image/png');

        // Create a download link
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `frame-${currentFrameIndex + 1}.png`; // Suggest a file name
        document.body.appendChild(a); // Required for Firefox
        a.click(); // Trigger download
        document.body.removeChild(a); // Clean up

        // Optional: Indicate success (or just re-enable button)
        // alert(`Frame ${currentFrameIndex + 1} exported as PNG.`);

    } catch (error) {
        console.error("Error exporting frame as image:", error);
        alert("Failed to export frame as image. Check the console for details.");
    } finally {
        // Clean up temporary canvas
        // Note: toDataURL creates the data, the canvas isn't needed after that.
        // exportCanvas.remove(); // Removing the canvas created here is not strictly necessary as it's not attached to DOM, but can be done.

        // Re-enable button
        exportFrameImageButton.disabled = false;
        exportFrameImageButton.textContent = 'Export Current Frame as Image (PNG)';
    }
}

// Function to import animation from a file (JSON)
function importAnimation() {
    importFileInput.click(); // Trigger the hidden file input click
}

// --- Audio Functions ---
async function preloadStartupSound() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch('/startup_sound.mp3'); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        startupSoundBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error("Error pre-loading startup sound:", error);
        // If sound fails to load, the app will still work, just without the startup sound.
    }
}

async function playStartupSound() {
    if (!audioContext || !startupSoundBuffer) {
        console.warn("AudioContext or startup sound buffer not ready.");
        return;
    }

    try {
        // Resume AudioContext if it's suspended (required by autoplay policies)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = startupSoundBuffer;
        source.connect(audioContext.destination);
        source.start(0);
    } catch (error) {
        console.error("Error playing startup sound:", error);
    }
}

// --- Event Listeners ---
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing); // Stop drawing if mouse leaves canvas

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    // Ensure event object has necessary properties for getCanvasCoords
    if (e.touches && e.touches[0]) {
        startDrawing(e.touches[0]);
    }
}, { passive: false }); // Use passive: false to allow preventDefault

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
    // Ensure event object has necessary properties for getCanvasCoords
    if (e.touches && e.touches[0]) {
        draw(e.touches[0]);
    }
}, { passive: false });

canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

addFrameButton.addEventListener('click', () => addFrame(false));
deleteFrameButton.addEventListener('click', deleteFrame);
duplicateFrameButton.addEventListener('click', () => addFrame(true)); // Listener for the duplicate button

// Modified play/stop button listeners to ensure stopAnimation is explicitly enabled when needed
playAnimationButton.addEventListener('click', () => {
    playAnimation();
    // Ensure stop button is enabled after play starts
    stopAnimationButton.disabled = false;
});
stopAnimationButton.addEventListener('click', () => {
    stopAnimation();
    // Ensure play button is enabled after stop occurs
    playAnimationButton.disabled = false;
});

// Event listeners for tool settings
colorPicker.addEventListener('input', (e) => brushColor = e.target.value);
brushSizeSlider.addEventListener('input', (e) => brushSize = parseInt(e.target.value));

// Re-render current frame when onion skin settings change
// Add a check here so these only trigger renderFrame if not animating
onionSkinToggle.addEventListener('change', () => { if (animationInterval === null) renderFrame(); });
onionSkinPrevInput.addEventListener('input', () => { if (animationInterval === null) renderFrame(); });
onionSkinNextInput.addEventListener('input', () => { if (animationInterval === null) renderFrame(); });
onionSkinPrevOpacityInput.addEventListener('input', () => { if (animationInterval === null) renderFrame(); });
onionSkinNextOpacityInput.addEventListener('input', () => { if (animationInterval === null) renderFrame(); });

// Re-render when FPS changes (doesn't affect drawing, just playback, but good place to handle updates)
fpsInput.addEventListener('input', () => {
    // No immediate visual change on the canvas, but update internal state if needed or re-calculate playback speed
    // For now, just ensures the value is read correctly by playAnimation.
});

// Loop toggle doesn't need a listener for drawing/rendering
// It's only read when playAnimation is called.

// Tool button listeners
toolButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove 'active' class from all tool buttons
        toolButtons.forEach(btn => btn.classList.remove('active'));
        // Add 'active' class to the clicked button
        button.classList.add('active');
        // Update the current tool state
        currentTool = button.dataset.tool
    });
});

// Canvas size button listener
applyCanvasSizeButton.addEventListener('click', () => {
    const newWidth = parseInt(canvasWidthInput.value);
    const newHeight = parseInt(canvasHeightInput.value);

    // Basic validation
    if (isNaN(newWidth) || newWidth < 100) {
        alert("Please enter a valid width (minimum 100px).");
        canvasWidthInput.value = canvas.width; // Reset input
        return;
    }
    if (isNaN(newHeight) || newHeight < 100) {
        alert("Please enter a valid height (minimum 100px).");
        canvasHeightInput.value = canvas.height; // Reset input
        return;
    }

    resizeCanvas(newWidth, newHeight);
});

// File button listeners
exportAnimationButton.addEventListener('click', exportAnimation);
exportVideoButton.addEventListener('click', exportVideo);
importAnimationButton.addEventListener('click', () => importFileInput.click());
exportFrameImageButton.addEventListener('click', exportFrameAsImage);

importFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        return; // No file selected
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            // Basic validation
            if (!importedData || !Array.isArray(importedData.frames)) {
                alert("Invalid animation file format.");
                return;
            }

            // Stop any playing animation before loading new data
            stopAnimation();

            // Update canvas size first
            const newWidth = parseInt(importedData.canvasWidth) || 800; // Default if not provided
            const newHeight = parseInt(importedData.canvasHeight) || 600; // Default if not provided
            // Use resizeCanvas with clearFrames = false, then manually set frames if resize is successful
            const resizeSuccessful = resizeCanvas(newWidth, newHeight, false); // Don't clear frames automatically here

            if (resizeSuccessful) {
                // Update frames - ensure deep copy of points
                frames = importedData.frames.map(frame => frame.map(action => ({ ...action, points: [...action.points] })));

                // Update FPS
                fpsInput.value = parseInt(importedData.fps) || 12;

                // Select the first frame and update UI
                currentFrameIndex = 0;
                selectFrame(0); // This will render and update timeline

                alert("Animation imported successfully!");
            }
        } catch (error) {
            console.error("Error importing file:", error);
            alert("Failed to import animation file. It might be corrupted or in an incorrect format.");
        }
    };

    reader.onerror = () => {
        console.error("FileReader error:", reader.error);
        alert("Error reading file.");
    };

    reader.readAsText(file); // Read the file as text
});

// New: Preset size button listeners
presetSizeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const width = parseInt(button.dataset.width);
        const height = parseInt(button.dataset.height);

        // Update the input fields, but don't apply automatically
        // User still needs to click "Apply Size"
        canvasWidthInput.value = width;
        canvasHeightInput.value = height;
    });
});

// Add keyboard listener for spacebar
window.addEventListener('keydown', (event) => {
    // Check if the key is the spacebar and ensure an input element is not focused
    const focusedElement = document.activeElement;
    const isInputFocused = focusedElement.tagName === 'INPUT' || focusedElement.tagName === 'BUTTON' || focusedElement.tagName === 'LABEL' || focusedElement.tagName === 'TEXTAREA' || focusedElement.tagName === 'SELECT'; // Added SELECT for theme dropdown

    // Also check if the focused element is one of the controls we want to avoid activating spacebar on
    const isControlFocused = focusedElement === canvasWidthInput ||
        focusedElement === canvasHeightInput ||
        focusedElement === fpsInput ||
        focusedElement === onionSkinPrevInput ||
        focusedElement === onionSkinNextInput ||
        focusedElement === onionSkinPrevOpacityInput ||
        focusedElement === onionSkinNextOpacityInput ||
        focusedElement === themeSelect;

    if ((event.code === 'Space' || event.key === ' ') && !isInputFocused && !isControlFocused) {
        event.preventDefault(); // Prevent default spacebar action (scrolling)

        if (animationInterval === null) {
            // Ensure play button is enabled before attempting to click (though the checks in playAnimation should handle it)
            if (!playAnimationButton.disabled) {
                playAnimation(); // Play if not playing
            }
        } else {
            // Ensure stop button is enabled before attempting to click
            if (!stopAnimationButton.disabled) {
                stopAnimation(); // Stop if playing
            }
        }
    }
});

// New: Theme select listener
themeSelect.addEventListener('change', (event) => {
    applyTheme(event.target.value);
});

// Splash Screen Button Listeners
if (getStartedButton) {
    getStartedButton.addEventListener('click', () => showMainApplication(true)); // Start tutorial
}
if (cancelStartupButton) {
    cancelStartupButton.addEventListener('click', () => showMainApplication(false)); // Skip tutorial
}

// --- Initialization ---
// Preload sound on DOMContentLoaded. The app initialization will occur after splash screen.
window.addEventListener('DOMContentLoaded', () => {
    preloadStartupSound();
    createTutorialPopup(); // Create popup elements on DOM load
    // Note: initializeApp() is called by showMainApplication() after splash interaction
});

// --- Splash Screen and App Initialization ---
function showMainApplication(startTutorialFlag = false) {
    if (splashScreen) {
        splashScreen.style.display = 'none';
    }
    if (appContainer) {
        appContainer.style.display = 'flex'; // Restore original display type
    }
    if (frameTimelineContainer) {
        frameTimelineContainer.style.display = 'block'; // Restore original display type
    }

    // Initialize the main application logic
    initializeApp();

    // Play startup sound (do this before tutorial so it doesn't play over it)
    playStartupSound().catch(err => console.error("Error in playStartupSound from showMainApplication:", err));

    if (startTutorialFlag) {
        // Small delay to ensure UI is fully rendered and sound can play
        setTimeout(startTutorial, 100);
    }
}

// --- Tutorial Functions ---
function createTutorialPopup() {
    if (document.getElementById('tutorial-popup')) {
        tutorialPopup = document.getElementById('tutorial-popup');
        return;
    }
    tutorialPopup = document.createElement('div');
    tutorialPopup.id = 'tutorial-popup';
    tutorialPopup.style.display = 'none'; // Initially hidden
    tutorialPopup.innerHTML = `
        <div id="tutorial-message"></div>
        <div id="tutorial-navigation">
            <button id="tutorial-prev">Previous</button>
            <button id="tutorial-next">Next</button>
            <button id="tutorial-skip">End Tutorial</button>
        </div>
    `;
    document.body.appendChild(tutorialPopup);

    document.getElementById('tutorial-prev').addEventListener('click', prevTutorialStep);
    document.getElementById('tutorial-next').addEventListener('click', nextTutorialStep);
    document.getElementById('tutorial-skip').addEventListener('click', endTutorial);
}

function startTutorial() {
    if (tutorialSteps.length === 0 || !tutorialPopup) return;
    tutorialActive = true;
    currentTutorialStep = 0;
    displayTutorialStep();

    // Disable interactions with main app elements
    if (toolPanel) toolPanel.style.pointerEvents = 'none';
    if (canvas) canvas.style.pointerEvents = 'none';
    if (frameTimelineContainer) frameTimelineContainer.style.pointerEvents = 'none';
    // Ensure tutorial popup itself remains interactive
    tutorialPopup.style.pointerEvents = 'auto';
}

function displayTutorialStep() {
    if (!tutorialActive || currentTutorialStep < 0 || currentTutorialStep >= tutorialSteps.length || !tutorialPopup) {
        endTutorial();
        return;
    }

    // Remove previous highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
    });

    const step = tutorialSteps[currentTutorialStep];
    const messageDiv = document.getElementById('tutorial-message');
    if(messageDiv) messageDiv.innerHTML = step.message; // Use innerHTML for potential formatting

    const targetElement = document.getElementById(step.elementId);
    tutorialPopup.style.display = 'block';

    if (targetElement && step.highlight) {
        targetElement.classList.add('tutorial-highlight');
        // Ensure the highlighted element is visible if its parent is scrollable
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });


        const targetRect = targetElement.getBoundingClientRect();
        const popupRect = tutorialPopup.getBoundingClientRect(); // Get dimensions after display:block

        let top, left;

        // Attempt to position popup relative to the element
        // This is a simplified positioning logic. More robust would involve checking viewport collision.
        switch (step.position) {
            case 'top':
                top = targetRect.top - popupRect.height - 10;
                left = targetRect.left + (targetRect.width / 2) - (popupRect.width / 2);
                break;
            case 'bottom':
                top = targetRect.bottom + 10;
                left = targetRect.left + (targetRect.width / 2) - (popupRect.width / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (popupRect.height / 2);
                left = targetRect.left - popupRect.width - 10;
                break;
            case 'right':
            default:
                top = targetRect.top + (targetRect.height / 2) - (popupRect.height / 2);
                left = targetRect.right + 10;
                break;
        }
        
        // Basic boundary collision detection
        if (top < 10) top = 10;
        if (left < 10) left = 10;
        if (left + popupRect.width > window.innerWidth - 10) {
            left = window.innerWidth - popupRect.width - 10;
        }
        if (top + popupRect.height > window.innerHeight - 10) {
            top = window.innerHeight - popupRect.height - 10;
        }


        tutorialPopup.style.top = `${top}px`;
        tutorialPopup.style.left = `${left}px`;
        tutorialPopup.style.transform = ''; // Reset transform if it was centered

    } else {
        // If no target element or no highlight, center the popup as a general message
        tutorialPopup.style.top = '50%';
        tutorialPopup.style.left = '50%';
        tutorialPopup.style.transform = 'translate(-50%, -50%)';
    }

    const prevButton = document.getElementById('tutorial-prev');
    const nextButton = document.getElementById('tutorial-next');
    if (prevButton) prevButton.disabled = currentTutorialStep === 0;
    if (nextButton) nextButton.textContent = (currentTutorialStep === tutorialSteps.length - 1) ? 'Finish' : 'Next';
}

function nextTutorialStep() {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        displayTutorialStep();
    } else {
        endTutorial();
    }
}

function prevTutorialStep() {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        displayTutorialStep();
    }
}

function endTutorial() {
    tutorialActive = false;
    if (tutorialPopup) {
        tutorialPopup.style.display = 'none';
    }
    // Remove highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
    });
    // Re-enable app interactions
    if(toolPanel) toolPanel.style.pointerEvents = 'auto';
    if(canvas) canvas.style.pointerEvents = 'auto';
    if(frameTimelineContainer) frameTimelineContainer.style.pointerEvents = 'auto';
}

// --- Initialization ---
function initializeApp() {
    loadTheme(); // This will apply theme
    resizeCanvas(parseInt(canvasWidthInput.value), parseInt(canvasHeightInput.value), true);

    // Ensure stop button is initially hidden and disabled
    stopAnimationButton.style.display = 'none';
    stopAnimationButton.disabled = true;
    // Ensure export image button is initially enabled
    exportFrameImageButton.disabled = false;

    // Add any other one-time setup for the application here
}

// Helper function to resize the canvas
function resizeCanvas(width, height, clearFrames = true) {
    // Clear existing frames if requested or if frames exist and we're resizing manually
    if (clearFrames && frames.length > 0) {
        const confirmResize = confirm("Changing canvas size will clear all frames. Are you sure?");
        if (!confirmResize) {
            // Restore input values if user cancels
            canvasWidthInput.value = canvas.width;
            canvasHeightInput.value = canvas.height;
            return false; // Indicate that resize was cancelled
        }
        frames = [];
        currentFrameIndex = 0;
    } else if (!clearFrames && (canvas.width !== width || canvas.height !== height)) {
        // If not clearing frames but size is changing (e.g., import),
        // For this simple app, we just proceed.
        console.warn("Canvas size changed, existing frame data may not render correctly.");
    }

    canvas.width = width;
    canvas.height = height;

    // Update input values to reflect current canvas size
    canvasWidthInput.value = width;
    canvasHeightInput.value = height;

    // Add a new frame if frames were cleared or if it was initially empty
    if (frames.length === 0) {
        addFrame(); // Add the first frame back
    } else {
        // Redraw the current frame after resize
        renderFrame();
        updateTimeline();
    }
    return true; // Indicate that resize was successful
}
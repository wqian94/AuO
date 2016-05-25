/**
 * AuO.js
 *
 * Version 0.1 (beta) distribution.
 *
 * Main entry point for the AuO library. Create a new instance of AuO by calling new AuO(). Calling
 * launch() adds the instance to the DOM tree, and calling suspend() removes the instance from the
 * DOM tree.
 *
 * To enable saving to a server, pass in a string containing the URL to upload the file to. AuO
 * uses secure POST-based file transfer, so make sure that the URL support that.
 *
 * @constructor
 */
const AuO = function (SAVE_URL = null) {
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions in the AuO interface.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Launches this instance of AuO. Application becomes visible to the user. Will automatically
     * set the z-index so that the launched instance has higher z-index than all other elements on
     * the page.
     */
    this.launch = function () {
        const allElements = document.getElementsByTagName("*");
        const allElementsZindex = Array.from(allElements).map(function (element) {
            return parseInt(element.style.zIndex);
        });
        const maxZindex = Math.max.apply(null, allElementsZindex);
        container.style("z-index", maxZindex + 1);
        document.body.appendChild(container.element());
        run();
    };

    /**
     * Suspends using this instance of AuO. Removes the application from the DOM tree and sets
     * the z-index to -Infinity. The interface is only hidden from view, however. To stop all
     * services, the instance itself must be deleted.
     */
    this.suspend = function () {
        suspendInstance();
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables for keeping track of the state.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    const state = {};

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Runtime code.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Runs this instance of AuO by initiating runtime procedures for this instance of AuO. Called
     * by this.launch().
     */
    const run = function () {
        if (state.running) {
            return;
        }

        runtimeAtInitiation();

        state.running = true;
    };

    /**
     * Suspends this AuO instance.
     */
    const suspendInstance = function () {
        if (!state.running) {
            return;
        }

        state.running = false;

        runtimeAtSuspension();
        container.detach().style("z-index", -Infinity);
    };

    /**
     * Resets the internal state of this AuO instance.
     */
    const stateReset = function () {
        state.audioBuffer = null;
        state.audioPlaybackCurrentTime = function () {
            return 0;
        };
        state.audioPlaybackSource = null;
        state.data = [];
        state.dataIndicesProcessed = 0;
        state.dataSamplesProcessed = 0;
        state.dataUpdated = false;
        state.drawing = false;
        state.elapsedTime = 0;
        state.endRecording = false;
        state.playing = false;
        state.recording = false;
        state.trimEnd = 0;  // In seconds.
        state.trimStart = 0;  // In seconds.
    };

    /**
     * Code run at the end of constructing a new AuO instance.
     */
    const runtimeAtConstruction = function () {
        state.running = false;

        state.audioOnDrag = function () {};
        state.audioOnDrop = function () {};

        state.callbackDraw = null;
        stateReset();

        toggleButton(buttonPlay, false);
        toggleButton(buttonStop, false);

        state.zoom = 0;
        zoomUpdate();

        editorMode(false);

        // TODO: replace with navigator.mediaDrevices.getUserMedia API when it becomes available.
        navigator.getUserMedia({audio: "true"}, beginAudioRecording, console.error);
        audioContext.suspend();
    };

    /**
     * Code run at initiate step of an AuO instance.
     */
    const runtimeAtInitiation = function () {
        stateReset();
        audioContext.resume();

        // Draw the visual for the start trimming box.

        (function () {
            const context = audioStartTrimmerVisual.element().getContext("2d");

            const width = audioStartTrimmerVisual.element().clientWidth;
            const height = audioStartTrimmerVisual.element().clientHeight;
            audioStartTrimmerVisual.set("width", width.toString() + "px");
            audioStartTrimmerVisual.set("height", height.toString() + "px");

            context.fillStyle = "transparent";
            context.fillRect(0, 0, width, height);

            context.lineWidth = 5;
            context.strokeStyle = "rgba(0, 200, 200, 0.4)";
            context.beginPath();
            context.moveTo(context.lineWidth, context.lineWidth);
            context.lineTo(width - context.lineWidth, 0.5 * height);
            context.lineTo(context.lineWidth, height - context.lineWidth);
            context.stroke();
        })();

        // Draw the visual for the end trimming box.

        (function () {
            const context = audioEndTrimmerVisual.element().getContext("2d");

            const width = audioEndTrimmerVisual.element().clientWidth;
            const height = audioEndTrimmerVisual.element().clientHeight;
            audioEndTrimmerVisual.set("width", width);
            audioEndTrimmerVisual.set("height", height);

            context.fillStyle = "transparent";
            context.fillRect(0, 0, width, height);

            context.lineWidth = 5;
            context.strokeStyle = "rgba(0, 200, 200, 0.4)";
            context.beginPath();
            context.moveTo(width - context.lineWidth, context.lineWidth);
            context.lineTo(context.lineWidth, 0.5 * height);
            context.lineTo(width - context.lineWidth, height - context.lineWidth);
            context.stroke();
        })();

        // Flag for whether to automatically sync the audio ticker.
        state.audioTickerSync = true;

        // Flag for whether to automatically sync the trimmer.
        state.audioTrimSync = true;

        // Ensures that the visualizer layer sits above the display itself.
        audioVisualizer.style("z-index", 1 + parseInt(container.element().style.zIndex));

        audioDisplay.set("height", audioDisplay.element().clientHeight);
        toggleButton(buttonRecord);
        toggleButton(buttonPlay, false);
        toggleButton(buttonStop, false);
        toggleButton(buttonSave, false);

        beginAudioDisplayLoop();
        window.addEventListener("resize", animateAudioDisplayByForce);
    };

    /**
     * Code run upon suspending an AuO instance. Does resource clean-up.
     */
    const runtimeAtSuspension = function () {
        if (!isNil(state.callbackDraw)) {
            clearInterval(state.callbackDraw);
            state.callbackDraw = null;
        }
        if (!isNil(state.audioPlaybackSource)) {
            state.audioPlaybackSource.stop();
            delete state.audioPlaybackSource;
            state.audioPlaybackSource = null;
        }
        window.removeEventListener("resize", animateAudioDisplayByForce);
        audioContext.suspend();
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // General tools for working with the WebAudio and MediaStream APIs.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // TODO: Remove this once navigator.mediaDevices.getUserMedia becomes supported.
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia || navigator.msGetUserMedia;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for audio UI display.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Begins and registers audio display loop.
     */
    const beginAudioDisplayLoop = function () {
        // If a loop is already ongoing, then do no thing.
        if (!isNil(state.callbackDraw)) {
            return;
        }

        const fps = 60;
        const millisecondsPerFrame = 1000 / fps;

        state.callbackDraw = setInterval(function () {
            if (true === state.dataUpdated) {
                window.requestAnimationFrame(animateAudioDisplay);
            }
            if (true === state.audioTickerSync) {
                window.requestAnimationFrame(animateAudioTicker);
            }
            if (true === state.audioTrimSync) {
                window.requestAnimationFrame(animateAudioTrimmers);
            }
        }, millisecondsPerFrame);
    };

    /**
     * Forces an animation frame update without interrupting the update loop if it's running.
     */
    const animateAudioDisplayByForce = function() {
        state.dataUpdated = true;
        animateAudioDisplay();
    };

    /**
     * Draws a frame for the audio display.
     */
    const animateAudioDisplay = function () {
        const viewWidth = audioUI.element().clientWidth - 2 * VISUALIZER_BUFFER;

        // We have new data to draw.
        if (!state.drawing && state.dataUpdated) {
            // Weak mutual exclusion.
            state.drawing = true;

            /**
             * Converts an integer sample index >= 0 to a value X coordinate.
             */
            const sampleToX = function (sample) {
                return sample * zoomFactor() * viewWidth / totalSamples;
            };

            /**
             * Converts a value from [-1.0, 1] to a value Y coordinate.
             */
            const valueToY = function (value) {
                return 0.5 * (1 - value) * canvasHeight;
            };

            /**
             * Draws a time at the given location on the given canvas.
             */
            const timeLabel = function (canvas, time, x) {
                canvas.font = "10px serif";
                const displayString = time.toFixed(fixPoint) + "s";
                canvas.fillText(displayString, x - 2.5 * displayString.length, canvasHeight);
            };

            // Cumulative time, number of series, and number of samples.
            const totalTime = state.elapsedTime;
            const totalSeries = state.data.length;
            for (var index = state.dataIndicesProcessed; index < totalSeries; index++) {
                state.dataSamplesProcessed += state.data[index].length;
            }
            state.dataIndicesProcessed = totalSeries;
            const totalSamples = state.dataSamplesProcessed;

            // Resize display canvas and visualizer layer.
            const width = Math.max(viewWidth, sampleToX(totalSamples));
            audioDisplay.style("width", width.toString() + "px");
            audioDisplay.set("width", width);
            audioVisualizer.style("width", (width + 2 * VISUALIZER_BUFFER).toString() + "px");
            const canvasWidth = audioDisplay.get("width");
            const canvasHeight = audioDisplay.get("height");

            // Reset canvas.
            const canvases = [];
            for (var i = 0; i < audioDisplay.count(); i++) {
                canvases.push(audioDisplay.element(i).getContext("2d"));
            }
            for (const canvas of canvases) {
                canvas.clearRect(0, 0, canvasWidth, canvasHeight);
                canvas.lineWidth = 1;
                canvas.strokeStyle = "rgb(0, 0, 0)";
                canvas.beginPath();
            }

            // Determine the rate of samples being drawn.
            const samplesPerInterval = Math.max(1, Math.round(totalSamples / canvasWidth));

            // Compute time steps. We want 10 time values drawn in a view window.
            const timeStep = viewWidth * totalTime / canvasWidth / 10;
            const fixPoint = Math.min(6, Math.max(0, parseInt(2 - Math.log(timeStep) / Math.log(10))));

            // Iterate along the data and plot.
            var sample = 0, time = 0;
            for (var series = 0; series < totalSeries; series++) {
                for (var item = 0; item < state.data[series].length; item++) {
                    const x = sampleToX(sample);
                    for (const canvas of canvases) {
                        if (0 === sample % samplesPerInterval) {
                            const value = state.data[series][item];
                            const y = valueToY(value);

                            if (0 === sample) {
                                canvas.moveTo(x, y);
                            } else {
                                canvas.lineTo(x, y);
                            }
                        }

                        // Determine the time for this sample and whether we should draw it.
                        const sampleTime = convertUnits(sample, totalSamples, totalTime);
                        if (parseInt(time / timeStep) < parseInt(sampleTime / timeStep)) {
                            timeLabel(canvas, sampleTime, x);
                            time = sampleTime;
                        }
                    }

                    sample++;
                }
            }

            for (const canvas of canvases) {
                // Draw the label for the last time step, for aesthetic purposes.
                timeLabel(canvas, totalTime, sampleToX(totalSamples));

                canvas.stroke();

                canvas.fillStyle = "rgba(50, 150, 50, 0.5)";
                canvas.fillRect(-1, 0, 2, canvasHeight);
                canvas.fillRect(canvasWidth - 1, 0, 2, canvasHeight);
            }

            state.dataUpdated = false;
            state.drawing = false;
        }
    };

    /**
     * Animates and moves the current time ticker.
     */
    const animateAudioTicker = function () {
        const currentTime = Math.max(state.trimStart, Math.min(state.elapsedTime - state.trimEnd,
            state.audioPlaybackCurrentTime()));
        const canvasWidth = audioDisplay.get("width");
        const tickerWidth = audioTicker.element().offsetWidth;
        const tickerRawOffset = convertUnits(currentTime, state.elapsedTime, canvasWidth);
        const tickerOffset = Math.max(0, Math.min(canvasWidth, tickerRawOffset));
        const tickerLocation = tickerOffset + VISUALIZER_BUFFER - 0.5 * tickerWidth;

        // Move and label the ticker.
        audioTicker.style("left", tickerLocation.toString() + "px");
        audioTickerLabel.set("innerHTML", currentTime.toFixed(2) + "s");

        // Move the ticker label to the correct side of the bar.
        if (tickerOffset <= 0.5 * canvasWidth) {
            audioTicker.style("direction", "ltr");
            audioTickerLabel.style("margin-left", "calc(100% + 4px)");
            audioTickerLabel.style("margin-right", "0px");
        } else {
            audioTicker.style("direction", "rtl");
            audioTickerLabel.style("margin-left", "0px");
            audioTickerLabel.style("margin-right", "calc(100% + 4px)");
        }
    };

    /**
     * Animates and resizes the trimmer boxes.
     */
    const animateAudioTrimmers = function () {
        const canvasWidth = audioDisplay.get("width");
        const uiWidth = audioUI.element().clientWidth;
        const visualizerWidth = audioVisualizer.element().clientWidth;

        // Update the start trimming box.
        const startTime = state.trimStart;
        const startWidth = audioStartTrimmer.element().clientWidth;
        const startBorderWidth = audioStartTrimmer.element().offsetWidth - startWidth;
        const startNewWidth = convertUnits(startTime, state.elapsedTime, canvasWidth) +
            VISUALIZER_BUFFER - startBorderWidth;
        audioStartTrimmer.style("width", startNewWidth.toString() + "px");
        audioStartTrimmerLabel.set("innerHTML", startTime.toFixed(2) + "s");

        // Update the end trimming box.
        const endTime = state.trimEnd;
        const endWidth = audioStartTrimmer.element().clientWidth;
        const endBorderWidth = audioStartTrimmer.element().offsetWidth - endWidth;
        const endNewWidth = convertUnits(endTime, state.elapsedTime, canvasWidth) +
            VISUALIZER_BUFFER - endBorderWidth;
        audioEndTrimmer.style("right", (uiWidth - visualizerWidth).toString() + "px");
        audioEndTrimmer.style("width", endNewWidth.toString() + "px");
        audioEndTrimmerLabel.set("innerHTML", endTime.toFixed(2) + "s");
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for audio recording.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Sets up audio recording functionalities. Is passed into getUserMedia().
     */
    const beginAudioRecording = function (stream) {
        const streamSource = audioContext.createMediaStreamSource(stream);

        // TODO: update this to use AudioWorkerNode once it becomes an available API
        // Set up the script node for intercepting the PCM data from the microphone
        const recordingBufferNode = audioContext.createScriptProcessor(0, 1, 1);
        recordingBufferNode.onaudioprocess = processAudioRecording;

        // Necessary to complete the stream so that the data actually streams through the
        // bufferNode.
        const mockDestinationNode = audioContext.createMediaStreamDestination();

        streamSource.connect(recordingBufferNode);
        recordingBufferNode.connect(mockDestinationNode);
    };

    /**
     * Postprocessing after audio recording ends. Called when stopping recording.
     */
    const endAudioRecording = function () {
        const dataLength = state.dataSamplesProcessed;
        const sampleRate = audioContext.sampleRate;

        // Deallocate resources for the old buffer if old data has been buffered.
        if (!isNil(state.audioBuffer)) {
            delete state.audioBuffer;
        }

        // We have only one channel.
        const numberOfChannels = 1;
        const channel = 0;

        // Create the buffer upon completion of recording.
        state.audioBuffer = audioContext.createBuffer(numberOfChannels, dataLength, sampleRate);

        // Populate the buffer.
        var sample = 0;
        for (const series of state.data) {
            for (const value of series) {
                state.audioBuffer.getChannelData(channel)[sample] = value;
                sample++;
            }
        }
    };

    /**
     * Processing function for recording process's script processor node.
     *
     * TODO: Supporting multiple channels: when it becomes necessary to support multiple channels,
     * note these following key things:
     * - The hardcoded channel 0 below should instead result in iterations over the channels where
     *   it is used.
     * - The playback and save loops will need to also accommodate multiple channels. To do this
     *   change the AudioBuffer created in endAudioRecording() to the appropriate number of
     *   channels, and everything else in the playback and save should work as normal.
     * - Animations currently assume only one canvas. To support multiple canvases, the easiest
     *   conversion may be to allow the FunctionalElement class to support wrapping around an array
     *   of identical elements, and apply the functional operations on all of the elements. This
     *   can be implemented by changing the representation of FunctionalElement to be an array, and
     *   the array has at least 1 element contained in it. This allows for all the operations to be
     *   written in terms of iterations.
     * - Since the number of channels is not known at construction time, the canvas count and the
     *   contexts (i.e. state.contextDraw) need to be abstracted out as well. At this point, it may
     *   be best to introduce a new class that bundles the contexts with the canvases, so that the
     *   operations can once again operate on a group with iterations handled internally by this
     *   other class.
     * - Styles and classes may require significant rework as a result of a dynamic number of
     *   canvases. To accommodate this, the best idea is to create another div placeholder parent
     *   for all the canvases, so that z-index and ordering works properly during dynamic
     *   reallocations of the canvases and contexts. Furthermore, this abstracts out the canvases
     *   from the DOM structure itself, and should result in fewer encumbering changes to the CSS
     *   and general stylings.
     */
    const processAudioRecording = function (event) {
        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;

        // We only have 1 channel
        const channel = 0;

        if (state.recording) {
            if (state.endRecording) {
                state.recording = false;
            }

            state.elapsedTime += inputBuffer.duration;

            // Shallow-copies data and pushes it into our stored data.
            state.data.push(inputBuffer.getChannelData(channel).slice());
            state.dataUpdated = true;

            if (state.endRecording) {
                setTimeout(function () {
                    endAudioRecording();

                    // Reset UI to indicate that post-processing of recording has completed.
                    buttonStop.set("innerHTML", "Stop");
                    editorMode(true);
                    toggleButton(buttonPlay);
                    toggleButton(buttonRecord);
                    toggleButton(buttonSave);
                }, 0);
                state.endRecording = false;
            }
        }

        for (var i = 0; i < inputBuffer.getChannelData(channel).length; i++) {
            outputBuffer.getChannelData(channel)[i] = inputBuffer.getChannelData(channel)[i];
        }
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for audio playback.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Takes in start and end times to play back the recording between those. Defaults to playing
     * the entire recording if no parameters are passed in.
     */
    const beginAudioPlayback = function (start = 0, end = Infinity) {
        if (Infinity === end) {
            end = state.elapsedTime;
        }

        // Re-compute the full buffer if it is missing elements.
        if (state.audioBuffer.length < state.dataSamplesProcessed) {
            buttonPlay.set("innerHTML", "Processing...");
            endAudioRecording();
            buttonPlay.set("innerHTML", "Play");
        }

        // Connect the buffer to the speaker.
        const playbackBuffer = state.audioBuffer;
        const playbackSource = audioContext.createBufferSource();
        playbackSource.buffer = playbackBuffer;
        playbackSource.onended = function (event) {
            buttonStop.element().click();
        };
        if (!isNil(state.audioPlaybackSource)) {
            delete state.audioPlaybackSource;
        }
        state.audioPlaybackSource = playbackSource;
        playbackSource.connect(audioContext.destination);

        const playbackStartTime = audioContext.currentTime;
        playbackSource.start(playbackStartTime, start, end - start);
        state.audioPlaybackCurrentTime = function () {
            return Math.max(0, audioContext.currentTime - playbackStartTime + start);
        };
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for saving an audio recording as a file.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Produces a Blob that is the audio sample from start to finish. Once the file is ready, will
     * pass the file in as the parameter to the function onready.
     */
    const beginAudioSave = function (onready, start = 0, end = Infinity) {
        if (Infinity === end) {
            end = state.elapsedTime;
        }

        // Re-compute the full buffer if it is missing elements.
        if (state.audioBuffer.length < state.dataSamplesProcessed) {
            endAudioRecording();
        }

        // Create a stream destination node and a MediaRecorder to use its stream.
        const saveBuffer = state.audioBuffer;
        const saveDestination = audioContext.createMediaStreamDestination();
        const saveRecorder = new MediaRecorder(saveDestination.stream);

        // Connect the buffer to the speaker.
        const saveSource = audioContext.createBufferSource();
        saveSource.buffer = saveBuffer;
        saveSource.connect(saveDestination);

        // Create a buffer for all the blobs.
        const saveBlobs = [];
        saveRecorder.ondataavailable = function (event) {
            saveBlobs.push(event.data);
        };

        saveRecorder.onstop = function (event) {
            const saveBlob = new Blob(saveBlobs, {"type": "audio/webm; codecs=opus"});
            onready(saveBlob);
        };

        saveSource.onended = function (event) {
            saveRecorder.stop();
        };

        saveRecorder.start();
        saveSource.start(audioContext.currentTime, start, end - start);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Helper functions for the entire library.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Convert from some unit to some other unit, with the given base scalings that correspond to 1.
     */
    const convertUnits = function (valueFrom, baseFrom, baseTo) {
        return (0 === valueFrom ? 0 : valueFrom * baseTo / baseFrom);
    };

    /**
     * Enables and disables editor mode, which determines whether editing features are on.
     */
    const editorMode = function (on = true) {
        state.editor = on;
        audioEndTrimmer.set("draggable", on);
        audioStartTrimmer.set("draggable", on);
        audioTicker.set("draggable", on);
        audioVisualizer.set("draggable", on);
    };

    /**
     * Determines whether the value is a nil-value. A nil value is an undefined or a null.
     */
    const isNil = function (value) {
        return (undefined === value) || (null === value);
    };

    /**
     * Constant for allowed slack between two times to still consider them to be equal. Used to
     * mitigate small time differences due to runtimes.
     *
     * Given in seconds.
     */
    const TIME_EPSILON = 1e-10;

    /**
     * Determines whether the two given times are approximately equal -- that is, within
     * TIME_EPSILON of each other.
     */
    const timeEqualsA = function (time1, time2) {
        return Math.abs(time1 - time2) <= TIME_EPSILON;
    };

    /**
     * Toggles the button into the enabled/disabled state.
     */
    const toggleButton = function (button, enable = true) {
        if (enable) {
            button.set("disabled", null).style("color", "#000");
        } else {
            button.set("disabled", true).style("color", "#888");
        }
    };

    /**
     * The amount of extra space on the left and right ends of the visualizer to allow for better
     * drag-and-drop behavior, in pixels. Must correspond to the same constant in the stylesheets.
     */
    const VISUALIZER_BUFFER = 50;

    /**
     * The minimum zoom level.
     */
    const ZOOM_MIN = 0;

    /**
     * The maximum zoom level.
     */
    const ZOOM_MAX = 16;

    /**
     * Retrieves the zoom factor.
     */
    const zoomFactor = function () {
        return Math.pow(1.2, state.zoom);
    };

    /**
     * Updates the display to indicate the zoom level.
     */
    const zoomUpdate = function () {
        // Use regex to parse the zoom level into the format that we want to show.
        const matches = (100.0 * zoomFactor()).toString().match(/^\d{2}\d*|^(0|\.)*([.0-9]{3})/);
        var zoom = matches[0];

        // Remove trailing decimal points.
        if ("." === zoom.substring(zoom.length - 1)) {
            zoom = zoom.substring(0, zoom.length - 1);
        }

        zoomDisplay.set("innerHTML", "Zoom: " + zoom + "%");

        // Deal with when scrolling is now past the max allowed scroll.
        const maxScroll = audioVisualizer.element().clientWidth - audioUI.element().clientWidth;
        const currentScroll = audioUI.element().scrollLeft;
        audioUI.element().scrollLeft = Math.max(0, Math.min(maxScroll, currentScroll));

        // Update button visuals.
        toggleButton(buttonZoomIn, state.zoom < ZOOM_MAX);
        toggleButton(buttonZoomOut, state.zoom > ZOOM_MIN);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Helper class FunctionalElement for functional language-style HTML DOM manipulations.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * A functional, stripped-down wrapper around HTML DOM elements. Also allows bundling elements
     * together so that operations work on them collectively.
     *
     * Invariant: the encapsulated elements can never be undefined or null, and the array must have
     * at least 1 element. All of the elements must have the same attributes and styles.
     *
     * Functions:
     *     resize(max_size) -- attempts to resize by creating shallow copies of the first element
     *         and appending them to the first element's parent, if it exists. If max_size is less
     *         than or equal to count(), does nothing.
     *     count() -- returns the number of elements that have been bundled together in this
     *         FunctionalElement instance.
     *     element(index = 0) -- accessor for the encapsulated elements. Defaults to just the first
     *         element, which is also the only element for single-element cases.
     *     get(attribute) -- wrapper for getAttribute(attribute).
     *     set(attribute, value) -- wrapper for setAttribute(attribute, value) and
     *         removeAttribute(attribute). The latter is called if the value is undefined or null,
     *         otherwise the former is called. For the innerHTML attribute, will treat undefined
     *         and null as empty strings.
     *     class(classname, add) -- forcibly add or remove the class from the element(s).
     *     style(property, value) -- wrapper for style.setProperty(property, value).
     *     append(child, index = 0) -- wrapper for appendChild(child). Will append all the children
     *         to the specified element at the given index. Defaults to appending all the children
     *         to the first element.
     *     remove(child) -- wrapper for removeChild(child).
     *     attach(parent, index = 0) -- appends the element(s) to the specified parent at the given
     *         element index, which defaults to the first element.
     *     detach() -- removes the element(s) as children of their parent.
     *     listen(event, callback) -- wrapper for addEventListener(event, callback).
     *
     * @constructor
     */
    const FunctionalElement = function (tagname, count = 1) {
        const elements = [];
        for (var i = 0; i < count; i++) {
            elements.push(document.createElement(tagname));
        }
        this.resize = function (max_size) {
            while (max_size > this.count()) {
                const element = elements[0].cloneNode();
                if (!isNil(elements[0].parentNode)) {
                    elements[0].parentNode.appendChild(element);
                }
                elements.push(element);
            }
            return this;
        };
        this.count = function () {
            return elements.length;
        };
        this.element = function (index = 0) {
            return elements[index];
        };
        this.get = function (attribute) {
            // Assuming that the default element is representative of all the elements.
            return this.element().getAttribute(attribute);
        };
        this.set = function (attribute, value) {
            for (const element of elements) {
                if ("innerHTML" === attribute) {
                    element.innerHTML = (isNil(value) ? "" : value);
                } else {
                    if (isNil(value)) {
                        element.removeAttribute(attribute);
                    } else {
                        element.setAttribute(attribute, value);
                    }
                }
            }
            return this;
        };
        this.class = function (classname, add = true) {
            for (const element of elements) {
                element.classList.toggle(classname, add);
            }
            return this;
        };
        this.style = function (property, value) {
            for (const element of elements) {
                element.style.setProperty(property, value);
            }
            return this;
        };
        this.append = function (child, index = 0) {
            for (var i = 0; i < child.count(); i++) {
                this.element(index).appendChild(child.element(i));
            }
            return this;
        };
        this.remove = function (child) {
            for (const element of elements) {
                element.removechild(child.element());
            }
            return this;
        };
        this.attach = function (parent, index = 0) {
            if (!isNil(parent)) {
                for (const element of elements) {
                    parent.element(index).appendChild(element);
                }
            }
            return this;
        };
        this.detach = function () {
            for (const element of elements) {
                isNil(element.parentNode) || element.parentNode.removeChild(element);
            }
            return this;
        };
        this.listen = function (event, callback) {
            for (const element of elements) {
                element.addEventListener(event, callback);
            }
            return this;
        };
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Create the DOM elements we want to work with.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // Highest-level container for the interface, also responsible for the faded screen background.
    const container = new FunctionalElement("div");

    // Container for the main UI.
    const mainUI = new FunctionalElement("div");

    // Title bar for the UI.
    const titleBar = new FunctionalElement("div");
    const title = new FunctionalElement("div");
    const titleClose = new FunctionalElement("div");

    // Container for the controls UI.
    const controlsUI = new FunctionalElement("div");

    // Buttons for controlling recording and playback.
    const buttonRecord = new FunctionalElement("button");
    const buttonPlay = new FunctionalElement("button");
    const buttonStop = new FunctionalElement("button");
    const buttonSave = new FunctionalElement("button");

    // Container for the zoom UI.
    const zoomUI = new FunctionalElement("div");

    // Buttons for zooming.
    const buttonZoomIn = new FunctionalElement("button");
    const buttonZoomOut = new FunctionalElement("button");
    const buttonZoomReset = new FunctionalElement("button");

    // Display for the zoom value for the zoom UI.
    const zoomDisplay = new FunctionalElement("div");

    // Container for the audio UI.
    const audioUI = new FunctionalElement("div");

    // Container for the audio display.
    const audioDisplayContainer = new FunctionalElement("div");

    // Display for the visualizer of the audio.
    const audioDisplay = new FunctionalElement("canvas");

    // Base layer for the visualizer, on top of the canvas. Necessary for proper drag-and-drop
    // behavior using the ticker.
    const audioVisualizer = new FunctionalElement("div");

    // Red bar for indicating the current time frame on the display.
    const audioTicker = new FunctionalElement("div");

    // The ticker's label.
    const audioTickerLabel = new FunctionalElement("div");

    // Start trimming box.
    const audioStartTrimmer = new FunctionalElement("div");

    // Start trimmer's label.
    const audioStartTrimmerLabel = new FunctionalElement("div");

    // Start trimmer's visual.
    const audioStartTrimmerVisual = new FunctionalElement("canvas");

    // End trimming box.
    const audioEndTrimmer = new FunctionalElement("div");

    // End trimmer's label.
    const audioEndTrimmerLabel = new FunctionalElement("div");

    // End trimmer's visual.
    const audioEndTrimmerVisual = new FunctionalElement("canvas");

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Hook up the appropriate listeners.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // Prevent events from propagating to elements underneath the AuO instance.
    container.listen("click", function (event) {
        event.stopPropagation();
    });

    // Closing via crosshairs is equivalent to suspending the instance.
    titleClose.listen("click", function (event) {
        suspendInstance();
    });

    // Clicking the record button.
    buttonRecord.listen("click", function (event) {
        stateReset();
        state.recording = true;

        editorMode(false);
        toggleButton(buttonPlay, false);
        toggleButton(buttonStop);
        toggleButton(buttonSave, false);
        toggleButton(buttonRecord, false);
    });

    // Clicking the play button.
    buttonPlay.listen("click", function (event) {
        state.playing = true;

        editorMode(false);
        toggleButton(buttonRecord, false);
        toggleButton(buttonSave, false);
        toggleButton(buttonStop);
        toggleButton(buttonPlay, false);

        const currentTime = Math.max(state.trimStart, state.audioPlaybackCurrentTime());
        const endTime = state.elapsedTime - state.trimEnd;
        const startTime = (currentTime > endTime || timeEqualsA(currentTime, endTime) ?
            state.trimStart : currentTime);
        state.audioTickerSync = true;
        beginAudioPlayback(startTime, endTime);
    });

    // Clicking the stop button.
    buttonStop.listen("click", function (event) {
        if (state.playing) {
            state.audioPlaybackSource.stop();
            if (!isNil(state.audioPlaybackSource)) {
                delete state.audioPlaybackSource;
            }
            state.audioPlaybackSource = null;

            const playbackStopTime = state.audioPlaybackCurrentTime();
            state.audioPlaybackCurrentTime = function () {
                return playbackStopTime;
            };

            state.playing = false;

            toggleButton(buttonPlay);
            editorMode(true);
            toggleButton(buttonRecord);
            toggleButton(buttonSave);
        } else if (state.recording) {
            buttonStop.set("innerHTML", "Processing...");

            state.endRecording = true;
        }

        toggleButton(buttonStop, false);
    });

    // Clicking the save button.
    buttonSave.listen("click", function (event) {
        if (isNil(SAVE_URL)) {
            alert("Since no upload URL has been provided, the online save functionality is \
disabled. Please instantiate AuO with an upload URL if you wish to enable online recording.");
            return;
        }

        // UI change to let user know that save is being processed.
        buttonSave.set("innerHTML", "Processing...");
        editorMode(false);
        toggleButton(buttonSave, false);
        toggleButton(buttonPlay, false);
        toggleButton(buttonRecord, false);

        const endTime = state.elapsedTime - state.trimEnd;
        const startTime = state.trimStart;

        const request = new XMLHttpRequest();
        request.open("POST", SAVE_URL);
        request.onload = function() {
            // Change UI back to let use know that save is complete.
            buttonSave.set("innerHTML", "Save");
            editorMode(true);
            toggleButton(buttonPlay);
            toggleButton(buttonRecord);
            toggleButton(buttonSave);
            prompt("Link to saved audio clip: ", request.response);
        };
        beginAudioSave(function (blob) {
            request.send(blob);
        }, startTime, endTime);
    });

    // Clicking the zoom in button.
    buttonZoomIn.listen("click", function (event) {
        state.zoom = Math.min(ZOOM_MAX, state.zoom + 1);
        zoomUpdate();
        animateAudioDisplayByForce();
    });

    // Clicking the zoom out button.
    buttonZoomOut.listen("click", function (event) {
        state.zoom = Math.max(ZOOM_MIN, state.zoom - 1);
        zoomUpdate();
        animateAudioDisplayByForce();
    });

    // Clicking the zoom reset button.
    buttonZoomReset.listen("click", function (event) {
        state.zoom = 0;
        zoomUpdate();
        animateAudioDisplayByForce();
    });

    // Begin dragging the end trimming box.
    audioEndTrimmer.listen("dragstart", function (event) {
        event.dataTransfer.setData("text", "audioStartTrimmer");
        event.dataTransfer.effectAllowed = "move";

        // Disable automatic syncing.
        state.audioTrimSync = false;

        // Remember the x coordinate where the drag started. This is aligned with the start of the
        // visualizer.
        const xRef = event.offsetX + parseInt(audioEndTrimmer.element().offsetLeft);

        // Remember the time to offset from.
        const timeRef = state.trimEnd;

        state.audioOnDrag = function (x) {
            const canvasWidth = audioDisplay.get("width");
            const time = timeRef + convertUnits(xRef - x, canvasWidth, state.elapsedTime);
            state.trimEnd = Math.max(0, Math.min(state.elapsedTime - state.trimStart, time));
            animateAudioTrimmers();
        };

        state.audioOnDrop = function (event) {
            event.preventDefault();
            event.stopPropagation();
            state.audioTrimSync = true;
            animateAudioTrimmers();
        };

        // Remove ghost image when dragging.
        const emptyDragImage = new FunctionalElement("canvas");
        emptyDragImage.set("height", "0px").set("width", "0px");
        event.dataTransfer.setDragImage(emptyDragImage.element(), 0, 0);
    });

    // Begin dragging the start trimming box.
    audioStartTrimmer.listen("dragstart", function (event) {
        event.dataTransfer.setData("text", "audioStartTrimmer");
        event.dataTransfer.effectAllowed = "move";

        // Disable automatic syncing.
        state.audioTrimSync = false;

        // Remember the x coordinate where the drag started. This is aligned with the start of the
        // visualizer.
        const xRef = event.offsetX;

        // Remember the time to offset from.
        const timeRef = state.trimStart;

        state.audioOnDrag = function (x) {
            const canvasWidth = audioDisplay.get("width");
            const time = timeRef + convertUnits(x - xRef, canvasWidth, state.elapsedTime);
            state.trimStart = Math.max(0, Math.min(state.elapsedTime - state.trimEnd, time));
            animateAudioTrimmers();
        };

        state.audioOnDrop = function (event) {
            event.preventDefault();
            event.stopPropagation();
            state.audioTrimSync = true;
            animateAudioTrimmers();
        };

        // Remove ghost image when dragging.
        const emptyDragImage = new FunctionalElement("canvas");
        emptyDragImage.set("height", "0px").set("width", "0px");
        event.dataTransfer.setDragImage(emptyDragImage.element(), 0, 0);
    });

    // Begin dragging the ticker.
    audioTicker.listen("dragstart", function (event) {
        event.dataTransfer.setData("text", "audioTicker");
        event.dataTransfer.effectAllowed = "move";

        // Disable automatic syncing.
        state.audioTickerSync = false;

        state.audioOnDrag = function (x) {
            const canvasWidth = audioDisplay.get("width");
            const tickerWidth = audioTicker.element().offsetWidth;
            x = Math.max(0, Math.min(canvasWidth, x - 50));
            state.audioPlaybackCurrentTime = function () {
                return convertUnits(x, canvasWidth, state.elapsedTime);
            };
            animateAudioTicker();
        };

        state.audioOnDrop = function (event) {
            event.preventDefault();
            event.stopPropagation();
            state.audioTickerSync = true;
            animateAudioTicker();
        };

        // Remove ghost image when dragging.
        const emptyDragImage = new FunctionalElement("canvas");
        emptyDragImage.set("height", "0px").set("width", "0px");
        event.dataTransfer.setDragImage(emptyDragImage.element(), 0, 0);
    });

    // Begin dragging the visualizer itself.
    audioVisualizer.listen("dragstart", function (event) {
        event.dataTransfer.setData("text", "audioStartTrimmer");
        event.dataTransfer.effectAllowed = "move";

        // Remember the x coordinate where the drag started. This is aligned with the start of the
        // visualizer.
        const xRef = event.offsetX;

        // Remember the scroll to offset from.
        const scrollRef = audioUI.element().scrollLeft;

        state.audioOnDrag = function (x) {
            const scroll = scrollRef - (x - xRef);
            const maxScroll = audioVisualizer.element().clientWidth - audioUI.element().clientWidth;
            audioUI.element().scrollLeft = Math.max(0, Math.min(maxScroll, scroll));
        };

        state.audioOnDrop = function (event) {
            event.preventDefault();
            event.stopPropagation();
        };

        // Remove ghost image when dragging.
        const emptyDragImage = new FunctionalElement("canvas");
        emptyDragImage.set("height", "0px").set("width", "0px");
        event.dataTransfer.setDragImage(emptyDragImage.element(), 0, 0);
    });

    // Function for handling drop events.
    const audioDropHandler = function (event) {
        event.preventDefault();

        state.audioOnDrop(event);

        // Reset the drag and drop callbacks.
        state.audioOnDrag = function () {};
        state.audioOnDrop = function () {};
    };

    audioEndTrimmer.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
        state.audioOnDrag(event.offsetX + parseInt(audioEndTrimmer.element().offsetLeft));
    });

    audioEndTrimmerVisual.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
        state.audioOnDrag(event.offsetX + parseInt(audioEndTrimmerVisual.element().offsetLeft) +
            parseInt(audioEndTrimmer.element().offsetLeft));
    });

    audioStartTrimmer.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
        state.audioOnDrag(event.offsetX);
    });

    audioStartTrimmerVisual.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
        state.audioOnDrag(event.offsetX + parseInt(audioStartTrimmerVisual.element().offsetLeft));
    });

    audioTicker.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
        state.audioOnDrag(event.offsetX + parseInt(audioTicker.element().offsetLeft));
    });

    audioVisualizer.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
        state.audioOnDrag(event.offsetX);
    });

    container.listen("dragover", function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEvent = "move";
    });

    // Attach drop handlers.
    for (node of [audioDisplayContainer, audioEndTrimmer, audioEndTrimmerVisual, audioStartTrimmer,
            audioStartTrimmerVisual, audioVisualizer, container]) {
        node.listen("drop", audioDropHandler);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Build the DOM tree.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    container
        .append(new FunctionalElement("div").class("middle-container")
            .append(new FunctionalElement("div").class("center-container")
                .append(mainUI
                    .append(titleBar
                        .append(title)
                        .append(titleClose)
                    ).append(controlsUI
                        .append(buttonRecord)
                        .append(buttonPlay)
                        .append(buttonStop)
                        .append(buttonSave)
                    ).append(zoomUI
                        .append(zoomDisplay)
                        .append(buttonZoomIn)
                        .append(buttonZoomOut)
                        .append(buttonZoomReset)
                    ).append(audioUI
                        .append(audioDisplayContainer
                            .append(audioDisplay)
                        )
                        .append(audioVisualizer)
                        .append(audioEndTrimmer
                            .append(audioEndTrimmerVisual)
                            .append(audioEndTrimmerLabel)
                        )
                        .append(audioStartTrimmer
                            .append(audioStartTrimmerVisual)
                            .append(audioStartTrimmerLabel)
                        )
                        .append(audioTicker
                            .append(audioTickerLabel)
                        )
                    )
                )
            )
        )
    ;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Style the DOM elements. Styles are sorted lexically. Styles come before classes before sets.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // This namespace must match the one in the anonymous function for creating AuO styles below.
    const css_namespace = "AuO";

    container.class(css_namespace);

    mainUI.class("auo-main-ui");

    titleBar.class("auo-title-bar");
    title.class("auo-title").set("innerHTML", "AuO: Online Audio Recorder and Editor");
    titleClose.class("auo-title-close").set("innerHTML", "[Close] &times;");

    controlsUI.class("auo-controls-ui");
    buttonRecord.set("innerHTML", "Record");
    buttonPlay.set("innerHTML", "Play");
    buttonStop.set("innerHTML", "Stop");
    buttonSave.set("innerHTML", "Save");

    audioUI.class("auo-audio-ui");
    audioDisplayContainer.class("auo-audio-display-container");
    audioDisplay.class("auo-audio-display");

    audioVisualizer.class("auo-audio-visualizer");
    audioTicker.class("auo-audio-ticker");
    audioTickerLabel.class("auo-audio-ticker-label");
    audioStartTrimmer.class("auo-audio-start-trimmer");
    audioStartTrimmerLabel.class("auo-audio-start-trimmer-label");
    audioEndTrimmer.class("auo-audio-end-trimmer");
    audioEndTrimmerLabel.class("auo-audio-end-trimmer-label");

    zoomUI.class("auo-zoom-ui");
    buttonZoomIn.set("innerHTML", "Zoom in");
    buttonZoomOut.set("innerHTML", "Zoom out");
    buttonZoomReset.set("innerHTML", "Zoom reset");
    zoomDisplay.class("auo-zoom-display");

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Complete runtime evaluations at the end of construction.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    runtimeAtConstruction();
};

/**
 * Anonymous function for generating and adding the AuO CSS style sheet.
 */
(function () {
    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Create a Sheet interface for working with CSSStyleSheets.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Creates a new style sheet and namespace. Sheet uses this namespace for constructing rules.
     * Rules will be automatically prepended with ".namespace " with the noticeable space.
     *
     * rule(rule, media) -- creates a new rule ".namespace rule" under the provided media. By
     *     default, media is null, which indicates to not use @media.
     */
    const Sheet = new (function() {
        // This namespace must match the one in the constructor of AuO instances above.
        const namespace = "AuO";

        // HTML style element used for generating the CSSStyleSheet object.
        const element = document.createElement("style");

        // Makes the style visible so that we can retrieve the CSSStyleSheet object from the document.
        document.head.appendChild(element);

        // Retrieves the corresponding CSSStyleSheet object.
        const sheet = element.sheet;

        this.rule = function (rule, media = null) {
            rule = "." + namespace + " " + rule.replace(/[\s]+/g, " ");
            if (undefined !== media && null !== media) {
                rule = "@media " + media + " { " + rule + " }";
            }
            sheet.insertRule(rule, sheet.cssRules.length);
        };
    })();

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Some constants for the styles.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * The amount of extra space on the left and right ends of the visualizer to allow for better
     * drag-and-drop behavior, in pixels. Must correspond to the same constant in the AuO instances.
     */
    const VISUALIZER_BUFFER = 50;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // General styling classes. Sorted lexically.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    Sheet.rule(`.center-container {
        text-align: center;
        width: 100%;
    }`);

    Sheet.rule(`.middle-container {
        display: block;
        height: 100%;
        white-space: nowrap;
    }`);

    Sheet.rule(`.middle-container:before {
        content: '';
        display: inline-block;
        height: 100%;
        vertical-align: middle;
        width: 0px;
    }`);

    Sheet.rule(`.middle-container > * {
        display: inline-block;
        vertical-align: middle;
    }`);

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Styling specific to AuO elements. Sorted in order of creation in AuO.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // Rule matching the container, which by default has the namespace as its class.
    Sheet.rule(`{
        background-color: rgba(0, 0, 0, 0.4);
        display: block;
        height: 100vh;
        left: 0px;
        overflow: auto;
        position: fixed;
        text-align: center;
        top: 0px;
        width: 100vw;
    }`);

    Sheet.rule(`.auo-main-ui {
        background-color: #FFF;
        border-radius: 10px;
        box-shadow: 10px 10px 5px rgba(0, 0, 0, 0.4);
        box-sizing: border-box;
        display: block;
        margin: auto;
        overflow: auto;
        padding: 25px;
        position: relative;
        text-align: justify;
    }`);

    Sheet.rule(`.auo-main-ui {
        white-space: nowrap;
        width: 80vw;
    }`, `(min-width: 640px)`);

    Sheet.rule(`.auo-main-ui {
        white-space: normal;
        width: 100%;
    }`, `(max-width: 640px)`);

    Sheet.rule(`.auo-title-bar {
        background-color: #DDD;
        display: block;
        font-size: 12pt;
        font-weight: bold;
        margin: -25px -25px 0px -25px;
        padding: 10px;
        white-space: nowrap;
        width: auto;
    }`);

    Sheet.rule(`.auo-title {
        display: inline-block;
        text-align: left;
        width: calc(100% - 120pt);
    }`);

    Sheet.rule(`.auo-title {
        font-size: 14pt;
    }`, `(min-width: 640px)`);

    Sheet.rule(`.auo-title {
        font-size: 10pt;
    }`, `(max-width: 640px)`);

    Sheet.rule(`.auo-title-close {
        display: inline-block;
        font-size: 10pt;
        text-align: right;
        width: 120pt;
    }`);

    Sheet.rule(`.auo-controls-ui {
        box-sizing: border-box;
        display: inline-block;
        padding: 2.5px;
        text-align: left;
        vertical-align: top;
        white-space: normal;
    }`);

    Sheet.rule(`.auo-controls-ui {
        width: 45%;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-controls-ui {
        width: 50%;
    }`, `(max-width: 1280px) and (min-width: 640px)`);

    Sheet.rule(`.auo-controls-ui {
        width: 100%;
    }`, `(max-width: 640px)`);

    Sheet.rule(`.auo-controls-ui > button {
        box-sizing: border-box;
    }`);

    Sheet.rule(`.auo-controls-ui > button {
        width: 100px;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-controls-ui > button {
        width: 100%;
    }`, `(max-width: 1280px)`);

    Sheet.rule(`.auo-controls-ui > button {
        margin: 2.5px;
    }`);

    Sheet.rule(`.auo-audio-ui {
        display: block;
        margin: 5px;
        overflow-x: scroll;
        overflow-y: visible;
        position: relative;
        white-space: normal;
        width: auto;
    }`);

    Sheet.rule(`.auo-audio-display-container {
        border: 0px;
        display: block;
        margin: 0px;
        padding: 0px;
    }`);

    Sheet.rule(`.auo-audio-display {
        box-sizing: content-box;
        display: block;
        margin: 0px ` + VISUALIZER_BUFFER.toString() + `px;
        height: 100px;
        width: calc(100% - ` + (2 * VISUALIZER_BUFFER).toString() + `px);
    }`);

    Sheet.rule(`.auo-audio-visualizer {
        border: 0px;
        height: 100%;
        left: 0px;
        margin: 0px;
        padding: 0px;
        position: absolute;
        pointer-events: auto;
        top: 0px;
        width: 100%;
    }`);

    Sheet.rule(`.auo-audio-ticker {
        background-color: #F00;
        border: 0px;
        display: block;
        height: 100%;
        left: 0px;
        position: absolute;
        top: 0px;
        width: 3px;
    }`);

    Sheet.rule(`.auo-audio-ticker:hover {
        border-color: #AAF;
        border-style: solid;
        border-width: 2px 4px;
        border-radius: 2px;
        height: calc(100% - 4px);
    }`);

    Sheet.rule(`.auo-audio-ticker > .auo-audio-ticker-label {
        background-color: #FFF;
        direction: inherit;
        display: none;
        font-size: 10pt;
        width: 0px;
    }`);

    Sheet.rule(`.auo-audio-ticker:hover > .auo-audio-ticker-label {
        display: block;
    }`);

    Sheet.rule(`.auo-audio-start-trimmer {
        background-color: rgba(0, 100, 100, 0.25);
        border-right: 4px solid transparent;
        direction: rtl;
        display: block;
        height: 100%;
        left: 0px;
        padding: 0px;
        position: absolute;
        text-align: right;
        top: 0px;
        width: ` + (VISUALIZER_BUFFER - 4).toString() + `px;
    }`);

    Sheet.rule(`.auo-audio-start-trimmer:hover {
        border-right: 4px solid #AAF;
    }`);

    Sheet.rule(`.auo-audio-start-trimmer > .auo-audio-start-trimmer-label {
        background-color: #FFF;
        direction: inherit;
        display: none;
        font-size: 10pt;
        right: 0px;
        position: absolute;
        top: 0px;
        width: 0px;
    }`);

    Sheet.rule(`.auo-audio-start-trimmer:hover > .auo-audio-start-trimmer-label {
        display: block;
    }`);

    Sheet.rule(`.auo-audio-start-trimmer > canvas {
        display: block;
        height: 100%;
        width: 32px;
    }`);

    Sheet.rule(`.auo-audio-end-trimmer {
        background-color: rgba(0, 100, 100, 0.25);
        border-left: 4px solid transparent;
        direction: ltr;
        display: block;
        height: 100%;
        padding: 0px;
        position: absolute;
        right: 0px;
        text-align: left;
        top: 0px;
        width: ` + (VISUALIZER_BUFFER - 4).toString() + `px;
    }`);

    Sheet.rule(`.auo-audio-end-trimmer:hover {
        border-left: 4px solid #AAF;
    }`);

    Sheet.rule(`.auo-audio-end-trimmer > canvas {
        display: block;
        height: 100%;
        width: 32px;
    }`);

    Sheet.rule(`.auo-audio-end-trimmer > .auo-audio-end-trimmer-label {
        background-color: #FFF;
        direction: inherit;
        display: none;
        font-size: 10pt;
        left: 0px;
        position: absolute;
        top: 0px;
        width: 0px;
    }`);

    Sheet.rule(`.auo-audio-end-trimmer:hover > .auo-audio-end-trimmer-label {
        display: block;
    }`);

    Sheet.rule(`.auo-zoom-ui {
        box-sizing: border-box;
        display: inline-block;
        padding: 5px;
        text-align: right;
        white-space: normal;
    }`);

    Sheet.rule(`.auo-zoom-ui {
        width: 55%;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-zoom-ui {
        width: 50%;
    }`, `(max-width: 1280px) and (min-width: 640px)`);

    Sheet.rule(`.auo-zoom-ui {
        width: 100%;
    }`, `(max-width: 640px)`);

    Sheet.rule(`.auo-zoom-ui > button {
        box-sizing: border-box;
        margin: 2.5px;
    }`);

    Sheet.rule(`.auo-zoom-ui > button {
        width: 100px;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-zoom-ui > button {
        width: 100%;
    }`, `(max-width: 1280px)`);

    Sheet.rule(`.auo-zoom-display {
        text-align: center;
        display: inline-block;
    }`);

    Sheet.rule(`.auo-zoom-display {
        width: 200px;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-zoom-display {
        width: 100%;
    }`, `(max-width: 1280px)`);
})();

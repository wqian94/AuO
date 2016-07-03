/**
 * AuO.js
 *
 * Version 1.3 (stable) distribution.
 *
 * Main entry point for the AuO library. Create a new instance of AuO by calling new AuO(). Calling
 * launch() adds the instance to the DOM tree, and calling suspend() removes the instance from the
 * DOM tree.
 *
 * To enable saving to a server, pass in a string containing the URL to upload the file to. AuO
 * uses secure POST-based file transfer, so make sure that the URL support that. For custom handling
 * of the callback after saving to the server, also pass in a function to the SAVE_CALLBACK
 * argument. This function will be passed the request object as its sole parameter, and calling
 * request.response will retrieve the response from the server. If no callback function is passed
 * in, the default callback (a prompt displaying the response of the server) will be used.
 *
 * If the SAVE_URL parameter is set to null, then local file handling launches upon save. This
 * results in a call to SAVE_CALLBACK with the blob as the parameter, instead of a server respond.
 * If SAVE_CALLBACK is null, then the default behavior is used, which is to prompt the user to
 * locally download the blob.
 *
 * If both parameters are omitted, then local file handling runs with the default callback, as if
 * both parameters were null.
 *
 * @constructor
 */
const AuO = function (SAVE_URL = null, SAVE_CALLBACK = null) {
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
            const zIndex = window.getComputedStyle(element).getPropertyValue("z-index");
            return isNaN(zIndex) ? 0 : zIndex;
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
        audioTicker.style("z-index", 2 + parseInt(container.element().style.zIndex));
        audioEndTrimmer.style("z-index", 2 + parseInt(container.element().style.zIndex));
        audioStartTrimmer.style("z-index", 2 + parseInt(container.element().style.zIndex));

        audioDisplay.set("height", audioDisplay.element().clientHeight);

        idleControls();
        toggleInput(buttonPlay, false);
        toggleInput(buttonSave, false);

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
    // Process constructor arguments.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // Default callback assignment.
    if (null === SAVE_CALLBACK) {
        if (null === SAVE_URL) {
            SAVE_CALLBACK = function (blob) {
                // Creates a new anchor link that targets the blob.
                new FunctionalElement("a")
                    .set("target", "_blank")
                    .set("href", window.URL.createObjectURL(blob))
                    .set("download", "recording." + saveFormat())
                    .element().click();
            };
        } else {
            SAVE_CALLBACK = function (request) {
                prompt("Link to saved audio clip: ", request.response);
            };
        }
    }

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

            const data = state.data;

            // Cumulative time, number of series, and number of samples.
            const totalTime = state.elapsedTime;
            const totalSeries = data.length;
            for (var index = state.dataIndicesProcessed; index < totalSeries; index++) {
                state.dataSamplesProcessed += data[index][0].length;
            }
            state.dataIndicesProcessed = totalSeries;
            const totalSamples = state.dataSamplesProcessed;

            if (0 < totalSeries) {
                audioDisplay.resize(data[0].length);
            }

            // Resize display canvas and visualizer layer.
            const width = zoomFactor() * viewWidth;
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

            const seriesAllTheSameLength = (0 === totalSeries) || (function () {
                const length = data[0][0].length;
                for (var seriesIndex = 1; seriesIndex < totalSeries; seriesIndex++) {
                    if (length !== data[seriesIndex][0].length) {
                        return false;
                    }
                }
                return true;
            })();

            // Iterate along intervals and retrieve data to plot.
            var seriesIndex = 0, itemIndex = 0;
            for (var sample = 0; sample < totalSamples; sample += samplesPerInterval) {
                if (seriesAllTheSameLength) {
                    seriesIndex = parseInt(sample / data[0][0].length);
                    itemIndex = sample % data[seriesIndex][0].length;
                } else {
                    while (seriesIndex < totalSeries) {
                        // We have found our series and corresponding data.
                        if (itemIndex < data[seriesIndex][0].length) {
                            break;
                        }

                        // Otherwise, look in the next series.
                        itemIndex -= data[seriesIndex][0].length;
                        seriesIndex++;
                    }

                    // Increment itemIndex.
                    itemIndex += samplesPerInterval;
                }

                const x = sample * zoomFactor() * viewWidth / totalSamples;
                for (var channel = 0; channel < canvases.length; channel++) {
                    const canvas = canvases[channel];
                    const value = data[seriesIndex][channel][itemIndex];
                    const y = 0.5 * (1 - value) * canvasHeight;

                    if (0 === sample) {
                        canvas.moveTo(x, y);
                    } else {
                        canvas.lineTo(x, y);
                    }
                }
            }

            // Draw time labels.
            for (var time = 0; time < totalTime + timeStep; time += timeStep) {
                const x = time * zoomFactor() * viewWidth / totalTime;
                const displayString = time.toFixed(fixPoint) + "s";
                for (const canvas of canvases) {
                    canvas.font = "10px serif";
                    canvas.fillText(displayString, x - 2.5 * displayString.length, canvasHeight);
                }
            }

            for (const canvas of canvases) {
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
        audioEndTrimmerLabel.set("innerHTML", "-" + endTime.toFixed(2) + "s");
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
        const numberOfChannels = audioDisplay.count();

        // Create the buffer upon completion of recording.
        state.audioBuffer = audioContext.createBuffer(numberOfChannels, dataLength, sampleRate);

        // Populate the buffer.
        var sample = 0;
        for (const series of state.data) {
            for (var item = 0; item < series[0].length; item++) {
                for (var channel = 0; channel < numberOfChannels; channel++) {
                    const value = series[channel][item];
                    state.audioBuffer.getChannelData(channel)[sample] = value;
                }
                sample++;
            }
        }
    };

    /**
     * Processing function for recording process's script processor node.
     */
    const processAudioRecording = function (event) {
        const recording = state.recording;
        const endRecording = state.endRecording;

        state.recording = state.recording && !endRecording;
        state.endRecording = recording && state.endRecording;

        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;

        const numberOfChannels = inputBuffer.numberOfChannels;

        if (recording) {
            state.elapsedTime += inputBuffer.duration;

            // Shallow-copies data and pushes it into our stored data.
            const data = [];
            for (var channel = 0; channel < numberOfChannels; channel++) {
                data.push(inputBuffer.getChannelData(channel).slice());
            }
            state.data.push(data);
            state.dataUpdated = true;
        } else if (endRecording) {
            setTimeout(function () {
                endAudioRecording();

                // Reset UI to indicate that post-processing of recording has completed.
                buttonStop.set("innerHTML", "Stop");
                editorMode(true);
                idleControls();
            }, 0);
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
    // Functions for loading audio into the editor.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Loads an audio file from the local filesystem into the buffer, as if it were just recorded,
     * using the files selected in the file selector.
     */
    const beginAudioLoad = function (files) {
        // Read in files.
        for (const file of files) {
            const loadReader = new FileReader();
            loadReader.onload = function (event) {
                const audioData = event.target.result;
                audioContext.decodeAudioData(audioData).then(function (buffer) {
                    stateReset();

                    const data = [];
                    for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
                        data.push(buffer.getChannelData(channel));
                    }

                    state.audioBuffer = buffer;
                    state.data = [data];
                    state.elapsedTime = buffer.duration;
                    state.dataUpdated = true;

                    editorMode(true);
                    idleControls();
                });
            };
            loadReader.readAsArrayBuffer(file);

            // TODO: Determine multiple-upload behavior and remove this line.
            break;  // Only deal with first file.
        }

        loadFile.element().value = null;
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for saving an audio recording as a file.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Produces a Blob that is the audio sample from start to finish. Once the file is ready, will
     * pass the file in as the parameter to the function onready. The start and end are given in
     * units of time (seconds).
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

        const format = saveFormat();
        if ("wav" === format) {
            // Format in http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html .

            const bytesPerSample = saveBuffer.getChannelData(0).__proto__.BYTES_PER_ELEMENT;
            const numChannels = saveBuffer.numberOfChannels;
            const sampleRate = saveBuffer.sampleRate;

            const startSample = Math.max(0, Math.round(start * sampleRate));
            const endSample = Math.min(saveBuffer.length, Math.round(end * sampleRate));
            const totalSamples = endSample - startSample;

            const blockAlign = bytesPerSample * numChannels;
            const byteRate = bytesPerSample * numChannels * sampleRate;
            const dataBytes = bytesPerSample * numChannels * totalSamples;
            const sampleLength = numChannels * totalSamples;

            // Chunk size = 4 + 48 + 12 + (8 + dataBytes + (dataBytes % 2)).
            const chunkSize = 4 + 48 + 12 + (8 + dataBytes + (dataBytes % 2));

            /**
             * Returns an array of the first blocks-th bytes of the value, in little-endian form.
             * The magic value 256 is the number of values in each byte block.
             */
            const getBytes = function (value, blocks) {
                const bytes = new Uint8Array(blocks);
                for (var i = 0; i < blocks; i++) {
                    bytes[i] = value % 256;
                    value /= 256;
                }
                return bytes;
            };
            const buffer = new ArrayBuffer(58 + dataBytes)
            const data = new Uint8Array(buffer);

            // Header (58 bytes).
            data.set([0x52, 0x49, 0x46, 0x46], 0);  // Chunk ID = "RIFF".
            data.set(getBytes(chunkSize, 4), 4);  // Chunk size.
            data.set([0x57, 0x41, 0x56, 0x45], 8);  // Wave ID = "WAVE".

            data.set([0x66, 0x6d, 0x74, 0x20], 12);  // Subchunk1 ID = "fmt ".
            data.set([0x12, 0x00, 0x00, 0x00], 16);  // Subchunk1 size = 18.
            data.set([0x03, 0x00], 20);  // AudioFormat = 0x0003 = WAVE_FORMAT_IEEE_FLOAT.
            data.set(getBytes(numChannels, 2), 22);  // Number of channels.
            data.set(getBytes(sampleRate, 4), 24);  // Samples per second.
            data.set(getBytes(byteRate, 4), 28);  // Bytes per second.
            data.set(getBytes(blockAlign, 2), 32);  // Block align.
            data.set(getBytes(8 * bytesPerSample, 2), 34);  // Bits per sample.
            data.set([0x00, 0x00], 36);  // Size of the extension = 0.

            data.set([0x66, 0x61, 0x63, 0x74], 38);  // Subchunk2 ID = "fact".
            data.set([0x04, 0x00, 0x00, 0x00], 42);  // Subchunk2 size = 4.
            data.set(getBytes(sampleLength, 4), 46);  // Sample length.

            data.set([0x64, 0x61, 0x74, 0x61], 50);  // Subchunk3 ID = "data".
            data.set(getBytes(dataBytes, 4), 54);  // Subchunk3 size = number of data bytes.

            // Data body (dataBytes bytes). Padding automatically during initialization to 0.
            for (var sample = 0; sample < totalSamples; sample++) {
                const frame = new Uint8Array(blockAlign);
                for (var channel = 0; channel < numChannels; channel++) {
                    // Convert from the float32 array data to the uint8 data.
                    const buffer = new ArrayBuffer(4);
                    const floatView = new Float32Array(buffer);
                    floatView[0] = saveBuffer.getChannelData(channel)[startSample + sample];
                    const channelData = new Uint8Array(buffer);
                    frame.set(channelData, bytesPerSample * channel);
                }
                data.set(frame, 58 + blockAlign * sample);
            }

            const saveBlob = new Blob([buffer], {"type": "audio/wav; codecs=pcm"});
            onready(saveBlob);
        } else if ("webm" === format) {
            const saveDestination = audioContext.createMediaStreamDestination();
            const saveRecorder = new MediaRecorder(saveDestination.stream);
            saveRecorder.onerror = console.error;
            saveRecorder.onwarning = console.error;

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
        }
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Helper functions for the entire library.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Returns the name of the browser. Returns "Unknown" if the browser name isn't identified.
     */
    const browserName = function () {
        if (!isNil(navigator.userAgent.match(/Chrome/))) {
            return "Chrome";
        } else if (!isNil(navigator.userAgent.match(/Firefox/))) {
            return "Firefox";
        }
        return "Unknown";
    };

    /**
     * Returns the browser version number. Returns "-0.Unknown.-0" if the version isn't identified.
     */
    const browserVersion = function () {
        const chromeMatches = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
        if (!isNil(chromeMatches)) {
            return chromeMatches[1];
        }

        const firefoxMatches = navigator.userAgent.match(/Firefox\/([0-9.]+)/);
        if (!isNil(firefoxMatches)) {
            return firefoxMatches[1];
        }

        return "-0.Unknown.-0";
    };

    /**
     * Returns the browser's major version number as an integer.
     */
    const browserVersionMajor = function () {
        const matches = browserVersion().match(/^\d+/);
        return parseInt(matches[0]);
    };

    /**
     * Changes the load label to the parameter string. If the string is nil or unset, will reset to
     * the default message, "Click here to select file".
     */
    const changeLoadLabel = function (message = null) {
        if (isNil(message)) {
            loadFileLabel.set("innerHTML", "Click here to select file.");
        } else {
            loadFileLabel.set("innerHTML", message);
        }
    };

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
    };

    /**
     * Returns an array of MIME types that are supported.
     */
    const getSupportedMIMEs = function () {
        return [
            "audio/wav",
            "audio/wave",
            "audio/webm",
            ];
    };

    /**
     * Helper function that resets all control UI buttons into the idle state. Resets the innerHTML
     * content and the disabled statuses. In the idle state, all buttons are enabled except the
     * stop button. Note that this is not the launch state.
     */
    const idleControls = function() {
        buttonRecord.set("innerHTML", "Record");
        buttonPlay.set("innerHTML", "Play");
        buttonStop.set("innerHTML", "Stop");
        changeLoadLabel();
        buttonLoad.set("innerHTML", "Load");
        buttonSave.set("innerHTML", "Save");

        toggleInput(buttonRecord);
        toggleInput(buttonPlay);
        toggleInput(buttonStop, false);
        toggleInput(buttonLoad, false);
        toggleInput(loadFile);
        toggleInput(buttonSave);
        toggleInput(saveOptions);
    };

    /**
     * Determines whether the value is a nil-value. A nil value is an undefined or a null.
     */
    const isNil = function (value) {
        return (undefined === value) || (null === value);
    };

    /**
     * Returns the currently-selected save format.
     */
    const saveFormat = function () {
        const index = saveOptions.element().selectedIndex;
        const format = saveOptions.element().options[index].value;
        return format;
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
    const toggleInput = function (button, enable = true) {
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
        toggleInput(buttonZoomIn, state.zoom < ZOOM_MAX);
        toggleInput(buttonZoomOut, state.zoom > ZOOM_MIN);
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
     *         than count(), truncates to the first max_size elements. If equals, does nothing.
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
            while (max_size < this.count()) {
                const element = elements[max_size];
                if (!isNil(element.parentNode)) {
                    element.parentNode.removeChild(element);
                }
                elements.splice(max_size, 1);
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

    // Start trimming box, label, and visual element.
    const audioStartTrimmer = new FunctionalElement("div");
    const audioStartTrimmerLabel = new FunctionalElement("div");
    const audioStartTrimmerVisual = new FunctionalElement("canvas");

    // End trimming box, label, and visual element.
    const audioEndTrimmer = new FunctionalElement("div");
    const audioEndTrimmerLabel = new FunctionalElement("div");
    const audioEndTrimmerVisual = new FunctionalElement("canvas");

    // Container for the load UI.
    const loadUI = new FunctionalElement("div");

    // File-loading input.
    const loadFile = new FunctionalElement("input");
    const loadFileLabel = new FunctionalElement("div");

    // Load button.
    const buttonLoad = new FunctionalElement("button");

    // Container for the save UI.
    const saveUI = new FunctionalElement("div");

    // Saving file format options.
    const saveOptions = new FunctionalElement("select");
    const saveOptionsLabel = new FunctionalElement("div");
    const saveOptionWAV = new FunctionalElement("option");
    const saveOptionWEBM = new FunctionalElement("option");

    // Save button.
    const buttonSave = new FunctionalElement("button");

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Hook up click listeners.
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
        toggleInput(buttonLoad, false);
        toggleInput(buttonPlay, false);
        toggleInput(buttonStop);
        toggleInput(buttonSave, false);
        toggleInput(buttonRecord, false);
    });

    // Clicking the play button.
    buttonPlay.listen("click", function (event) {
        state.playing = true;

        editorMode(false);
        toggleInput(buttonLoad, false);
        toggleInput(buttonRecord, false);
        toggleInput(buttonSave, false);
        toggleInput(buttonStop);
        toggleInput(buttonPlay, false);

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

            editorMode(true);
            idleControls();
        } else if (state.recording) {
            buttonStop.set("innerHTML", "Processing...");
            toggleInput(buttonStop, false);
            state.endRecording = true;
        }
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

    // Clicking the label for file loading.
    loadFileLabel.listen("click", function (event) {
        loadFile.element().click();
    });

    // Clicking the load button.
    buttonLoad.listen("click", function (event) {
        // UI change to let user know that load is being processed.
        buttonLoad.set("innerHTML", "Processing...");
        editorMode(false);
        toggleInput(buttonLoad, false);
        toggleInput(buttonPlay, false);
        toggleInput(buttonRecord, false);
        toggleInput(buttonSave, false);
        toggleInput(saveOptions, false);

        beginAudioLoad(loadFile.element().files);
    });

    // Clicking the save button.
    buttonSave.listen("click", function (event) {
        // UI change to let user know that save is being processed.
        buttonSave.set("innerHTML", "Processing...");
        editorMode(false);
        toggleInput(buttonSave, false);
        toggleInput(buttonLoad, false);
        toggleInput(buttonPlay, false);
        toggleInput(buttonRecord, false);
        toggleInput(saveOptions, false);

        const endTime = state.elapsedTime - state.trimEnd;
        const startTime = state.trimStart;

        beginAudioSave(function (blob) {
            if (isNil(SAVE_URL)) {
                editorMode(true);
                idleControls();

                // If no save URL is provided, run the save callback function on the blob.
                SAVE_CALLBACK(blob);
            } else {
                // If a save URL is provided, send an XHR to the target URL with the blob.
                const request = new XMLHttpRequest();
                request.open("POST", SAVE_URL, true);
                request.onload = function() {
                    // Change UI back to let use know that save is complete.
                    editorMode(true);
                    idleControls();

                    // [200, 300) are "okay" statuses.
                    if (this.status >= 200 && this.status < 300) {
                        SAVE_CALLBACK(request);
                    } else {
                        alert("Save failed. Error occurred while saving.");
                    }
                };
                request.onerror = function () {
                    idleControls();
                    alert("Save failed. Error occurred while saving.");
                };
                request.send(blob);
            }
        }, startTime, endTime);
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Hook up drag listeners.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

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

        state.audioOnDrag = function (x) {
            const scrollRef = audioUI.element().scrollLeft;
            const scroll = scrollRef - (x - xRef);  // Invert to implement drag-panning.
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
    // Hook up other listeners.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // Completing a file selection.
    loadFile.listen("change", function (event) {
        const files = loadFile.element().files;
        if (0 === files.length) {
            loadFileLabel.set("innerHTML", "Click here to select file");
            toggleInput(buttonLoad, false);
        } else {
            const selections = Array.prototype.reduce.call(files, function (prev, file) {
                prev.push(file.name);
                return prev;
            }, []);
            loadFileLabel.set("innerHTML", selections.sort().join("<br />"));
            toggleInput(buttonLoad);
        }
    });

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
                    ).append(loadUI
                        .append(loadFileLabel)
                        .append(loadFile)
                        .append(buttonLoad)
                    ).append(saveUI
                        .append(saveOptionsLabel)
                        .append(saveOptions)
                        .append(buttonSave)
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
    buttonRecord.class("auo-controls-record-button").set("innerHTML", "Record");
    buttonPlay.class("auo-controls-play-button").set("innerHTML", "Play");
    buttonStop.class("auo-controls-stop-button").set("innerHTML", "Stop");

    audioUI.class("auo-audio-ui");
    audioDisplayContainer.class("auo-audio-display-container");
    audioDisplay.class("auo-audio-display");

    audioVisualizer.class("auo-audio-visualizer").set("draggable", true);
    audioTicker.class("auo-audio-ticker");
    audioTickerLabel.class("auo-audio-ticker-label");
    audioStartTrimmer.class("auo-audio-start-trimmer");
    audioStartTrimmerLabel.class("auo-audio-start-trimmer-label");
    audioEndTrimmer.class("auo-audio-end-trimmer");
    audioEndTrimmerLabel.class("auo-audio-end-trimmer-label");

    zoomUI.class("auo-zoom-ui");
    buttonZoomIn.class("auo-zoom-in-button").set("innerHTML", "Zoom in");
    buttonZoomOut.class("auo-zoom-out-button").set("innerHTML", "Zoom out");
    buttonZoomReset.class("auo-zoom-reset-button").set("innerHTML", "Zoom reset");
    zoomDisplay.class("auo-zoom-display");

    loadUI.class("auo-load-ui");
    loadFileLabel.class("auo-load-file-label").class("middle-container");
    loadFile.class("auo-load-file").set("accept", getSupportedMIMEs().join(","))
        .set("type", "file");
    buttonLoad.class("auo-load-button").set("innerHTML", "Load");

    saveUI.class("auo-save-ui");
    saveOptionsLabel.class("auo-save-options-label").set("innerHTML", "Save file format:");
    saveOptions.class("auo-save-options");
    saveOptionWAV.set("innerHTML", "WAV").set("value", "wav").attach(saveOptions);
    if ("Chrome" !== browserName() || 50 <= browserVersionMajor()) {
        saveOptionWEBM.set("innerHTML", "WebM").set("value", "webm").attach(saveOptions);
    }
    buttonSave.class("auo-save-button").set("innerHTML", "Save");

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

    Sheet.rule(`button {
        font-family: inherit;
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
        margin: 2.5px;
    }`);

    Sheet.rule(`.auo-controls-ui > button {
        width: 100px;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-controls-ui > button {
        width: 100%;
    }`, `(max-width: 1280px)`);

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

    Sheet.rule(`.auo-audio-display:not(:first-child) {
        border-top: 10px solid rgba(200, 200, 200, 0.25);
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
        margin-top: -2px;
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

    Sheet.rule(`.auo-load-ui {
        display: inline-block;
        text-align: justify;
        width: 50%;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-load-ui {
        display: block;
        text-align: center;
        width: 100%;
    }`, `(max-width: 1280px)`);

    Sheet.rule(`.auo-load-ui > *{
        vertical-align: middle;
    }`);

    Sheet.rule(`.auo-load-file-label {
        border: 1px solid black;
        border-radius: 0.35em;
        box-sizing: border-box;
        display: inline-block;
        font-size: 0.9em;
        margin-right: 0.5em;
        max-height: 4em;
        max-width: 100%;
        overflow: auto;
        padding: 0.25em;
        vertical-align: middle;
    }`);

    Sheet.rule(`.auo-load-file-label:hover {
        background-color: rgba(225, 225, 225, 0.5);
    }`);

    Sheet.rule(`.auo-load-file {
        display: none;
    }`);

    Sheet.rule(`.auo-load-button {
        box-sizing: border-box;
        width: 100px;
    }`);

    Sheet.rule(`.auo-save-ui {
        display: inline-block;
        text-align: right;
        width: 50%;
    }`, `(min-width: 1280px)`);

    Sheet.rule(`.auo-save-ui {
        display: block;
        text-align: center;
        width: 100%;
    }`, `(max-width: 1280px)`);

    Sheet.rule(`.auo-save-ui > *{
        vertical-align: middle;
    }`);

    Sheet.rule(`.auo-save-options-label {
        display: inline-block;
    }`);

    Sheet.rule(`.auo-save-options {
        background: transparent;
        border: 0;
        box-sizing: border-box;
        font: inherit;
        margin: 0px 5px;
        width: 70px;
    }`);

    Sheet.rule(`.auo-save-button {
        box-sizing: border-box;
        width: 100px;
    }`);
})();

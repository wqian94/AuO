/**
 * AuO.js
 *
 * Main entry point for the AuO library. Create a new instance of AuO by calling new AuO(). Calling
 * launch() adds the instance to the DOM tree, and calling suspend() removes the instance from the
 * DOM tree.
 *
 * @constructor
 */
const AuO = function () {
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
            return element.style.zIndex;
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
        // This must be reset first for signaling purposes.
        state.running = false;

        state.audioPlaybackSource = null;
        state.callbackDraw = null;
        state.data = [];
        state.dataIndicesProcessed = 0;
        state.dataSamplesProcessed = 0;
        state.dataUpdated = false;
        state.drawing = false;
        state.elapsedTime = 0;
        state.playing = false;
        state.recording = false;

        state.contextDraw.clearRect(0, 0, audioDisplay.get("width"), audioDisplay.get("height"));
    };

    /**
     * Code run at the end of constructing a new AuO instance.
     */
    const runtimeAtConstruction = function () {
        state.contextDraw = audioDisplay.element().getContext("2d");
        stateReset();

        toggleButton(buttonPlay, false);
        toggleButton(buttonStop, false);

        state.zoom = 0;
        zoomUpdate();

        // TODO: replace with navigator.mediaDrevices.getUserMedia API when it becomes available.
        navigator.getUserMedia({audio: "true"}, beginAudioRecording, console.error);
    };

    /**
     * Code run at initiate step of an AuO instance.
     */
    const runtimeAtInitiation = function () {
        stateReset();

        audioDisplay.set("height", audioDisplay.element().clientHeight);

        beginAudioDisplayLoop();
        window.addEventListener("resize", animateAudioDisplayByForce);
    };

    /**
     * Code run upon suspending an AuO instance. Does resource clean-up.
     */
    const runtimeAtSuspension = function () {
        if (!isNil(state.callbackDraw)) {
            clearInterval(state.callbackDraw);
            callbackDraw = null;
        }
        if (!isNil(state.audioPlaybackSource)) {
            state.audioPlaybackSource.stop();
            state.audioPlaybackSource = null;
        }
        window.removeEventListener("resize", animateAudioDisplayByForce);
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
        const viewWidth = audioUI.element().clientWidth;

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
             * Draws a time at the given location.
             */
            const timeLabel = function (time, x) {
                canvas.font = "10px arial";
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

            // Resize display canvas.
            const width = Math.max(viewWidth, sampleToX(totalSamples));
            audioDisplay.style("width", width.toString() + "px");
            audioDisplay.set("width", width);
            const canvasWidth = audioDisplay.get("width");
            const canvasHeight = audioDisplay.get("height");

            // Reset canvas.
            const canvas = state.contextDraw;
            canvas.clearRect(0, 0, canvasWidth, canvasHeight);
            canvas.lineWidth = 1;
            canvas.strokeStyle = "rgb(0, 0, 0)";
            canvas.beginPath();

            // Determine the rate of samples being drawn.
            const samplesPerInterval = Math.max(1, Math.round(totalSamples / canvasWidth));

            // Compute time steps. We want 10 time values drawn in a view window.
            const timeStep = viewWidth * totalTime / canvasWidth / 10;
            const fixPoint = Math.min(6, Math.max(0, parseInt(2 - Math.log(timeStep) / Math.log(10))));

            // Iterate along the data and plot.
            var sample = 0, series = 0, time = 0;
            for (series = 0; series < totalSeries; series++) {
                for (const value of state.data[series]) {
                    const x = sampleToX(sample);
                    if (0 === sample % samplesPerInterval) {
                        const y = valueToY(value);

                        if (0 === sample) {
                            canvas.moveTo(x, y);
                        } else {
                            canvas.lineTo(x, y);
                        }
                    }

                    // Determine the time for this sample and whether we should draw it.
                    const sampleTime = sample * totalTime / totalSamples;
                    if (parseInt(time / timeStep) < parseInt(sampleTime / timeStep)) {
                        timeLabel(sampleTime, x);
                        time = sampleTime;
                    }

                    sample++;
                }
            }

            // Draw the label for the last time step, for aesthetic purposes.
            timeLabel(totalTime, sampleToX(totalSamples));

            canvas.stroke();
            state.dataUpdated = false;
            state.drawing = false;
        }
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for audio recording.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

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

    const processAudioRecording = function (event) {
        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;

        // We only have 1 channel
        const inputBufferData = inputBuffer.getChannelData(0);

        // Capture information about the input buffer to appropriately determine the environment
        // variables.
        state.audioSampleRate = inputBuffer.sampleRate;
        state.audioDataLength = inputBuffer.length;

        if (state.recording) {
            state.elapsedTime += inputBuffer.duration;

            // Shallow-copies data and pushes it into our stored data.
            state.data.push(inputBufferData.slice());
            state.dataUpdated = true;
        }

        for (var i = 0; i < inputBufferData.length; i++) {
            outputBuffer.getChannelData(0)[i] = inputBufferData[i];
        }
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Functions for audio playback.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    const beginAudioPlayback = function (start = 0, end = Infinity) {
        const dataLength = state.dataSamplesProcessed;
        const sampleRate = state.audioSampleRate;

        if (Infinity === end) {
            end = state.elapsedTime;
        }

        // TODO: same note as in audio recording about using AudioWorkerNode once it is available.
        const playbackBuffer = audioContext.createBuffer(1, dataLength, sampleRate);

        // Populate the buffer.
        var sample = 0;
        for (const series of state.data) {
            for (const value of series) {
                playbackBuffer.getChannelData(0)[sample] = value;
                sample++;
            }
        }

        // Connect the buffer to the speaker.
        const playbackSource = audioContext.createBufferSource();
        playbackSource.buffer = playbackBuffer;
        playbackSource.onended = function (event) {
            buttonStop.element().click();
        };
        playbackSource.connect(audioContext.destination);
        playbackSource.start(audioContext.currentTime, start, end);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Helper functions for the entire library.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Determines whether the value is a nil-value. A nil value is an undefined or a null.
     */
    const isNil = function (value) {
        return (undefined === value) || (null === value);
    };

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
        const matches = (100.0 * zoomFactor()).toString().match(/^\d{2}\d*|^(0|\.)*([.0-9]{3})/);
        var zoom = matches[0];
        if ("." === zoom.substring(zoom.length - 1)) {
            zoom = zoom.substring(0, zoom.length - 1);
        }
        zoomDisplay.set("innerHTML", "Zoom: " + zoom + "%");
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

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Helper class FunctionalElement for functional language-style HTML DOM manipulations.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * A functional, stripped-down wrapper around HTML DOM elements.
     *
     * Invariant: the encapsulated element can never be undefined or null.
     *
     * Functions:
     *     element -- accessor for the encapsulated element.
     *     get(attribute) -- wrapper for getAttribute(attribute).
     *     set(attribute, value) -- wrapper for setAttribute(attribute, value) and
     *         removeAttribute("attribute). The latter is called if the value is undefined or null,
     *         otherwise the former is called. For the innerHTML attribute, will treat undefined
     *         and null as empty strings.
     *     class(classname, add) -- forcibly add or remove the class from the element.
     *     style(property, value) -- wrapper for style.setProperty(property, value).
     *     append(child) -- wrapper for appendChild(child).
     *     remove(child) -- wrapper for removeChild(child).
     *     attach(parent) -- appends the element to the specified parent.
     *     detach() -- removes the element as a child of its parent.
     *     listen(event, callback) -- wrapper for addEventListener(event, callback).
     *
     * @constructor
     */
    const FunctionalElement = function (tagname) {
        const element = document.createElement(tagname);
        this.element = function() {
            return element;
        };
        this.get = function (attribute) {
            return element.getAttribute(attribute);
        };
        this.set = function (attribute, value) {
            if ("innerHTML" === attribute) {
                element.innerHTML = isNil(value) ? "" : value;
            } else {
                if (isNil(value)) {
                    element.removeAttribute(attribute);
                } else {
                    element.setAttribute(attribute, value);
                }
            }
            return this;
        };
        this.class = function (classname, add = true) {
            element.classList.toggle(classname, add);
            return this;
        };
        this.style = function (property, value) {
            element.style.setProperty(property, value);
            return this;
        };
        this.append = function (child) {
            element.appendChild(child.element());
            return this;
        };
        this.remove = function (child) {
            element.removechild(child.element());
            return this;
        };
        this.attach = function (parent) {
            isNil(parent) || parent.element.appendChild(element);
            return this;
        };
        this.detach = function () {
            isNil(element.parentNode) || element.parentNode.removeChild(element);
            return this;
        };
        this.listen = function (event, callback) {
            element.addEventListener(event, callback);
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

    // Display for the visualizer of the audio.
    const audioDisplay = new FunctionalElement("canvas");

    // Red bar for indicating the current time frame on the display.
    const audioCurrent = new FunctionalElement("div");

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

    buttonRecord.listen("click", function (event) {
        if (!isNil(state.audioPlaybackSource)) {
            state.audioPlaybackSource.stop();
            state.audioPlaybackSource = null;
        }

        stateReset();
        state.running = true;
        state.recording = true;

        toggleButton(buttonPlay, false);
        toggleButton(buttonStop);
        toggleButton(buttonRecord, false);
    });

    buttonPlay.listen("click", function (event) {
        state.running = true;
        state.playing = true;

        toggleButton(buttonRecord, false);
        toggleButton(buttonStop);
        toggleButton(buttonPlay, false);

        beginAudioPlayback();
    });

    buttonStop.listen("click", function (event) {
        state.playing = false;
        state.recording = false;

        toggleButton(buttonPlay);
        toggleButton(buttonRecord);
        toggleButton(buttonStop, false);
    });

    buttonZoomIn.listen("click", function (event) {
        state.zoom = Math.min(16, state.zoom + 1);
        zoomUpdate();
        animateAudioDisplayByForce();
    });

    buttonZoomOut.listen("click", function (event) {
        state.zoom = Math.max(-16, state.zoom - 1);
        zoomUpdate();
        animateAudioDisplayByForce();
    });

    buttonZoomReset.listen("click", function (event) {
        state.zoom = 0;
        zoomUpdate();
        animateAudioDisplayByForce();
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
                        .append(audioDisplay)
                        .append(audioCurrent)
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

    audioUI.class("auo-audio-ui");
    audioDisplay.class("auo-audio-display");
    audioCurrent.class("auo-audio-current");

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
        padding: 0px 0px 10px 0px;
        position: relative;
        text-align: justify;
        white-space: nowrap;
    }`);

    Sheet.rule(`.auo-main-ui {
        width: 80vw;
    }`, `(min-width: 600px)`);

    Sheet.rule(`.auo-main-ui {
        width: 100%;
    }`, `(max-width: 600px)`);

    Sheet.rule(`.auo-title-bar {
        background-color: #DDD;
        display: block;
        font-size: 12pt;
        font-weight: bold;
        padding: 5px;
        white-space: nowrap;
        width: auto;
    }`);

    Sheet.rule(`.auo-title {
        display: inline-block;
        font-size: 14pt;
        text-align: left;
        width: calc(100% - 120pt);
    }`);

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
        width: 40%;
    }`, `(min-width: 1200px)`);

    Sheet.rule(`.auo-controls-ui {
        width: 50%;
    }`, `(max-width: 1200px)`);

    Sheet.rule(`.auo-controls-ui > button {
        box-sizing: border-box;
    }`);

    Sheet.rule(`.auo-controls-ui > button {
        width: 100px;
    }`, `(min-width: 1200px)`);

    Sheet.rule(`.auo-controls-ui > button {
        width: 100%;
    }`, `(max-width: 1200px)`);

    Sheet.rule(`.auo-controls-ui > button {
        margin: 2.5px;
    }`);

    Sheet.rule(`.auo-audio-ui {
        display: block;
        margin: 5px;
        overflow-x: scroll;
        position: relative;
        white-space: normal;
        width: auto;
    }`);

    Sheet.rule(`.auo-audio-display {
        box-sizing: border-box;
        height: 100px;
        width: 100%;
    }`);

    Sheet.rule(`.auo-display-current {
        background-color: #F00;
        display: none;
        height: 100%;
        left: 0px;
        position: absolute;
        top: 0px;
        width: 1px;
    }`);

    Sheet.rule(`.auo-zoom-ui {
        box-sizing: border-box;
        display: inline-block;
        padding: 5px;
        text-align: right;
        white-space: normal;
    }`);

    Sheet.rule(`.auo-zoom-ui {
        width: 60%;
    }`, `(min-width: 1200px)`);

    Sheet.rule(`.auo-zoom-ui {
        width: 50%;
    }`, `(max-width: 1200px)`);

    Sheet.rule(`.auo-zoom-ui > button {
        box-sizing: border-box;
        margin: 2.5px;
    }`);

    Sheet.rule(`.auo-zoom-ui > button {
        width: 100px;
    }`, `(min-width: 1200px)`);

    Sheet.rule(`.auo-zoom-ui > button {
        width: 100%;
    }`, `(max-width: 1200px)`);

    Sheet.rule(`.auo-zoom-display {
        text-align: center;
        display: inline-block;
    }`);

    Sheet.rule(`.auo-zoom-display {
        width: 200px;
    }`, `(min-width: 1200px)`);

    Sheet.rule(`.auo-zoom-display {
        width: 100%;
    }`, `(max-width: 1200px)`);
})();

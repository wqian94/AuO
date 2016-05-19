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
        document.body.appendChild(container.element);
        initiate();
    };

    /**
     * Suspends using this instance of AuO. Removes the application from the DOM tree and sets
     * the z-index to -Infinity. The interface is only hidden from view, however. To stop all
     * services, the instance itself must be deleted.
     */
    this.suspend = function () {
        container.detach().style("z-index", -Infinity);
    };

    /**
     * Determines whether the value is a nil-value. A nil value is an undefined or a null.
     */
    const isNil = function (value) {
        return (undefined === value) || (null === value);
    };

    /**
     * A functional, stripped-down wrapper around HTML DOM elements.
     *
     * Functions:
     *     get(attribute) -- 
     *
     * @constructor
     */
    const FunctionalElement = function (tagname) {
        this.element = document.createElement(tagname);
        this.get = function (attribute) {
            this.element.getAttribute(attribute, val);
            return this;
        };
        this.set = function (attribute, value) {
            if ("innerHTML" === attribute) {
                this.element.innerHTML = isNil(value) ? "" : value;
            } else {
                if (isNil(value)) {
                    this.element.removeAttribute(attribute);
                } else {
                    this.element.setAttribute(attribute, value);
                }
            }
            return this;
        };
        this.style = function (property, value) {
            this.element.style.setProperty(property, value);
            return this;
        };
        this.append = function (child) {
            this.element.appendChild(child.element);
            return this;
        };
        this.remove = function (child) {
            this.element.removechild(child.element);
            return this;
        };
        this.attach = function (parent) {
            parent.element.appendChild(this.element);
            return this;
        };
        this.detach = function () {
            this.element.parentNode.removeChild(this.element);
            return this;
        };
        this.listen = function (event, callback) {
            this.element.addEventLister(event, callback);
            return this;
        };
    };

    var initiated = false;
    /**
     * Initiates runtime procedures for this instance of AuO. Will only run once throughout the
     * lifetime of an instance. Called by this.launch().
     */
    const initiate = function () {
        // Prevent multiple initiations.
        if (initiated) {
            return;
        }
        initiated = true;
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Create the DOM elements we want to work with.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // Highest-level container for the interface, also responsible for the faded screen background.
    const container = new FunctionalElement("div");

    // Element to enable vertical centering of the interface.
    const verticalMiddleButtress = new FunctionalElement("div");

    // Element to enable horizontal centering of the interface.
    const horizontalCenterContainer = new FunctionalElement("div");

    // Main frame for UI.
    const frame = new FunctionalElement("div");

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

    // Display for the zoom value for the zoom UI.
    const zoomDisplay = new FunctionalElement("div");

    // Container for the audio UI.
    const audioUI = new FunctionalElement("div");

    // Display for the visualizer of the audio.
    const audioDiplay = new FunctionalElement("canvas");

    // Red bar for indicating the current time frame on the display.
    const audioCurrent = new FunctionalElement("div");

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Build the DOM tree.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    container
        .append(verticalMiddleButtress)
        .append(horizontalCenterContainer
            .append(frame
                .append(titleBar
                    .append(title)
                    .append(titleClose)
                ).append(controlsUI
                    .append(buttonRecord)
                    .append(buttonPlay)
                    .append(buttonStop)
                ).append(audioUI
                    .append(audioDisplay)
                    .append(audioCurrent)
                ).append(zoomUI
                    .append(buttonZoomIn)
                    .append(zoomDisplay)
                    .append(buttonZoomOut)
                )
            )
        )
    ;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Style the DOM elements.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////
    container
        .style("position", "fixed")
        .style("top", "0px")
        .style("left", "0px")
        .style("width", "100%")
        .style("height", "100vh")
        .style("text-align", "center")
        .style("vertical-align", "middle")
        .style("background-color", "rgba(0, 0, 0, 0.6)");
};

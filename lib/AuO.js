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
        initiate();
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
    // Runtime code.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

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

        runtimeAtInitiation();
    };

    /**
     * Suspends this AuO instance.
     */
    const suspendInstance = function () {
        container.detach().style("z-index", -Infinity);
    };

    /**
     * Code run at the end of constructing a new AuO instance.
     */
    const runtimeAtConstruction = function () {
    };

    /**
     * Code run at initiate step of an AuO instance.
     */
    const runtimeAtInitiation = function() {
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
            element.getAttribute(attribute);
            return this;
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

    // Element to enable vertical centering of the interface.
    const verticalMiddleButtress = new FunctionalElement("div");

    // Element to enable horizontal centering of the interface.
    const horizontalCenterContainer = new FunctionalElement("div");

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

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Build the DOM tree.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    container
        .append(verticalMiddleButtress)
        .append(horizontalCenterContainer
            .append(mainUI
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
    // Style the DOM elements. Styles are sorted lexically. Styles come before sets.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    container
        .style("background-color", "rgba(0, 0, 0, 0.4)")
        .style("display", "block")
        .style("height", "100vh")
        .style("left", "0px")
        .style("position", "fixed")
        .style("text-align", "center")
        .style("top", "0px")
        .style("vertical-align", "middle")
        .style("width", "100%");

    verticalMiddleButtress
        .style("display", "inline-block")
        .style("height", "100%")
        .style("vertical-align", "middle")
        .style("width", "0px");

    horizontalCenterContainer
        .style("display", "inline-block")
        .style("text-align", "center")
        .style("vertical-align", "middle")
        .style("width", "100%");

    mainUI
        .style("background-color", "#FFF")
        .style("border-radius", "10px")
        .style("box-shadow", "10px 10px 5px rgba(0, 0, 0, 0.4)")
        .style("display", "block")
        .style("margin", "auto")
        .style("overflow", "auto")
        .style("padding", "10px")
        .style("position", "relative")
        .style("text-align", "justify")
        .style("white-space", "nowrap")
        .style("width", "80vw");

    titleBar
        .style("backgroud-color", "#DDD")
        .style("display", "block")
        .style("font-size", "12pt")
        .style("font-weight", "bold")
        .style("padding", "5px")
        .style("white-space", "nowrap")
        .style("width", "auto");

    title
        .style("display", "inline-block")
        .style("width", "calc(100% - 120pt)")
        .style("text-align", "left")
        .set("innerHTML", "Record custom sound");

    titleClose
        .style("display", "inline-block")
        .style("font-size", "14pt")
        .style("text-align", "right")
        .style("width", "120pt")
        .set("innerHTML", "[Close] &bigotimes;");

    controlsUI
        .style("display", "block")
        .style("margin", "5px")
        .style("vertical-align", "top")
        .style("white-space", "normal")
        .style("width", "auto");

    buttonRecord
        .style("width", "100px")
        .set("innerHTML", "Record");

    buttonPlay
        .style("margin-left", "5px")
        .style("width", "100px")
        .set("innerHTML", "Play");

    buttonStop
        .style("margin-left", "5px")
        .style("width", "100px")
        .set("innerHTML", "Stop");

    audioUI
        .style("display", "block")
        .style("overflow-x", "scroll")
        .style("margin", "5px")
        .style("position", "relative")
        .style("white-space", "normal")
        .style("width", "auto");

    audioDisplay
        .style("border-left", "1px solid blue")
        .style("height", "100px")
        .style("width", "100%")
        .set("height", "100%");

    audioCurrent
        .style("background-color", "red")
        .style("display", "none")
        .style("height", "100%")
        .style("left", "0px")
        .style("position", "absolute")
        .style("top", "0px")
        .style("width", "1px");

    zoomUI
        .style("display", "block")
        .style("margin-bottom", "5px")
        .style("margin-top", "5px")
        .style("text-align", "center")
        .style("width", "auto");

    buttonZoomIn
        .style("width", "100px")
        .set("innerHTML", "Zoom in");

    buttonZoomOut
        .style("width", "100px")
        .set("innerHTML", "Zoom out");

    zoomDisplay
        .style("display", "inline-block")
        .style("text-align", "center")
        .style("width", "300px");

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Complete runtime evaluations at the end of construction.
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    runtimeAtConstruction();
};

AuO version 1.3 (stable)
===
AuO (IPA: /ao/), a browser-based audio recording and editing application. Uses browser-native
technologies to avoid third-party dependencies.

# Licensing

AuO is released under the MIT License. See the LICENSE file in the repository for full license
details.

# Using AuO

Include AuO in any application by including AuO.js. Then, create an instance with

```javascript
const auo = new AuO(link_to_server_url, save_callback_function);
```

where `link_to_server` is the URL to upload audio clips and `save_callback_function` is the callback
function used to process the server's response after uploading the saved audio file. To use the
default callback (a prompt box that displays the server's response), only set `link_to_server_url`.

If `link_to_server_url` is null, then `save_callback_function` is called with the audio Blob as its
sole parameter, instead of a server response. If both `link_to_server_url` and
`save_callback_function` are omitted or null (both default to null), then the default local save
handler is invoked on save. This triggers the download of the audio recording with the name
`recording.ext` where `ext` is the appropriate extension for the save format chosen from the UI.

To launch AuO, simply call

```javascript
auo.launch();
```

and the interface should appear. To suspend AuO, click Close or call

```javascript
auo.suspend();
```

to make the interface disappear and prevent resource use. When you are ready to use AuO once more,
call

```javascript
auo.launch();
```

again to relaunch the interface using the same instance.

## Supported Browsers and Operating Systems

<table class="supported-browser">
    <tr><th style="border-top:0;border-left:0;">&nbsp;</th><th>Linux (Debian/Ubuntu)</th><th>Windows</th><th>Max OS X</th></tr>
    <tr><td>Chrome</td><td class="supported">49.0+</td><td class="supported">49.0+</td><td class="supported">49.0+</td></tr>
    <tr><td>Firefox</th><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td></tr>
    <tr><td>Edge</th><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td></tr>
    <tr><td>Internet Explorer</th><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td></tr>
    <tr><td>Opera</th><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td></tr>
    <tr><td>Safari</th><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td><td class="no-support">&#x2718;</td></tr>
</table>

# The AuO User Interface

AuO currently supports audio recording, playback, editing, and saving to a remote server. Currently,
there is no support for loading from and saving to a local file, or saving to any format other than
WebM and WAV. In addition, the user can also zoom in and out to focus on parts of the audio clip. At
the moment, AuO supports up to 16 levels of zoom, for a total magnification of approximately 18.5
times the original view of the waveform.

## Initial Launch

When AuO first launches, the user will see only the options to record and zoom, since AuO has not
captured any audio data yet. The first thing the user should do at this stage is click the `Record`
button.

<img src="img/initial-screen/auo-1440x900.png" alt="Initial Launch Screenshot 1440x900" height="400" />
<img src="img/initial-screen/auo-1280x950.png" alt="Initial Launch Screenshot 1280x950" height="400" />
<img src="img/initial-screen/auo-360x640.png" alt="Initial Launch Screenshot 360x640" height="400" />  
Above: Initial launch screenshots from a 1440px &times; 900px screen (larger laptop), 1280px &times;
950px screen (smaller laptop), and 360px &times; 640px screen (smartphone) in Google Chrome Version
51.0.2704.84 on Ubuntu Linux 14.04 (Trusty).

## Audio Recording

By clicking the `Record` button, the user can begin to gather audio feed live from the computer's
microphone, or potentially other connected audio recording devices as well. For first-time users, a
dialog box should appear in the browser to request permission to access the audio recording device,
and choose a device if the computer has multiple available devices. If this dialog box does not
appear, make sure that the browser's URL points to an `https://` URL (or `http://` if running on
localhost) and not a `file://` URL.

During recording, the user can zoom in and out, as well as reset the zoom to 100% if the current
zoom does not equal 100%.

To stop recording, the user can hit the `Stop` button. AuO will briefly pause to preprocess the
data for playbacks and saves, before entering the idle state.

## Zooming

At any point during recording and playback, or when AuO is idling, the user can click the `Zoom in`
and `Zoom out` buttons to zoom in and out of the visualizer graph, respectively. The graph will
automatically resize and relabel the times accordingly. The user can also reset the zoom to the
default value of 100% by clicking the `Zoom reset` button.

Increasing the zoom allows the user to set trimmings and playback points more accurately;
decreasing the zoom allows the user to better navigate through the entire audio track.

## Panning

At any point, the user can pan by dragging the graphs where the ticker and trimming boxes do not
cover the graphs. Dragging from right to left will pan right, and dragging from left to right will
pan left.

## Idling

AuO's idle state occurs when AuO has a recording stored, but no active actions on that recording.
The user can identify this by seeing if a graph exists, and whether the `Record`, `Play`, and
`Save` buttons have been disabled. If the graph does not exist, then AuO has not recorded anything
yet and is not in the idle state; similarly, if any of the three mentioned buttons has been
disabled, then AuO is currently performing that action and is not in the idle state.

<img src="img/idle-screen/auo-1440x900.png" alt="Idle State Screenshot 1440x900" height="400" />
<img src="img/idle-screen/auo-1280x950.png" alt="Idle State Screenshot 1280x950" height="400" />
<img src="img/idle-screen/auo-360x640.png" alt="Idle State Screenshot 360x640" height="400" />  
Above: Idle state screenshots from a 1440px &times; 900px screen (larger laptop), 1280px &times;
950px screen (smaller laptop), and 360px &times; 640px screen (smartphone) in Google Chrome Version
51.0.2704.84 on Ubuntu Linux 14.04 (Trusty).

In the idle state, the user can trim the audio clip from either end, as well as reposition the
ticker to begin playback at different parts of the audio recording.

## Ticker

The ticker is the red bar on the graph. This represents where AuO will begin playing the audio
recording when the user clicks `Play`. By moving this bar around, the user can allow AuO to begin
playing at different locations in the recording.

When hovering over the ticker, a label will appear next to the ticker to indicate the time that the
ticker is at.

## Trimming Boxes

At either end of the graph, there is a blue box with an arrow pointing toward the graph, as shown in
the screenshots above. These are the trimming boxes. The one on the left is the start-trimming box,
and the one on the right is the end-trimming box. These boxes represent the start and end of the
trimmed audio recording, respectively, and if one were to save the recording, the produced audio
clip will contain only the audio between the two boxes.

Similar to the ticker, when hovering over the trimming boxes, a label will appear next to the inner
edge of the box, indicating the trimming. Note that the start-trimming box displays positive time
to indicate offset from the start, and the end-trimming box displays negative time to indicate
offset from the end.

## Audio Playback

By clicking the `Play` button, the user can play back the recorded audio file, starting at the red
ticker and ending at the end-trimming box. Once it reaches the end, AuO will automatically stop
playback and return to the idle state. If the user clicks play when the ticker is already at the
end-trimming box, the ticker will instead loop to the start-trimming box and play the entirety of
the trimmed audio.

## Audio Editing

Currently, AuO only supports audio editing by trimming.

### Trimming

To trim an audio recording, the user simply drags either the start-trimming box or the end-trimming
box to reposition the start and end of the recording, respectively. If this leaves the ticker in a
location that would not be played as a result of the trimming, the ticker will automatically move
with the trimming boxes. If the trimming was made in error, repositioning the trimming box without
playing the trimmed audio will allow the ticker to reposition itself as close to its original
position as it can.

## Audio Saving

By clicking the `Save` button, the user can upload the trimmed audio recording to the server, which
should reply with a link to the saved audio clip. The user can retrieve this link from the dialog
box that pops up when the saving has succeeded. Both of these behaviors can be changed by altering
the server code as well as the callback handler.

If the server URL has been omitted or set to null, then clicking the `Save` button will instead
trigger a local file download by default, though this can also be altered by passing in a callback
handler that receives the audio Blob.

Users can choose the format in which AuO will save the audio recording by selecting the format from
the dropdown menu next to the `Save` button.

Currently, for Chrome 49, only WAV is available, while for Chrome 50+, both WAV and WebM are
available.

### Callback Function

The callback function is the second parameter in the constructor for a new AuO instance, and is
optional. This callback function is called once the server has responded with an HTTP 2xx in
response to the user's save request. If this parameter is omitted during construction, AuO will use
the default callback function, which produces a prompt dialog box with the server's response, as
shown in the image below:

![Default Save Callback Prompt Dialog](img/save-prompt/auo-save-prompt.png)

If the parameter was provided during construction, AuO will call that function and pass in one
parameter: the XMLHttpRequest object, whose `response` field contains the server's response.

# Providing a backend for AuO

The code in receive.php provides a simple PHP server-side script for supporting online file uploads
from AuO. This code is reproduced below:

```php
<?php
/**
 * receive.php
 *
 * A simple server-side script to interact with AuO for saving audio clips to a server. Update
 * $HOSTNAME to match the server's hostname and this file is all good to go. Just ensure that the
 * script has the requisite permissions to write to the server.
 */

$HOSTNAME = "https://localhost";  // Set this differently if you have a different host server.

// Make sure that the script has write permissions here!
if (!is_dir("sounds")) {
    `mkdir sounds`;
}

// Necessary for cross-origin requests, if AuO is hosted under a different host name than this
// script.
header('Access-Control-Allow-Headers: content-type');
header('Access-Control-Allow-Origin: *');

// Content type information.
$content_type = $_SERVER["CONTENT_TYPE"];
preg_match('/^audio\/([^; ]+); codecs=([^ ]+)/', $content_type, $content_type_matches);
$save_format = $content_type_matches[1];

$raw = file_get_contents('php://input');

// Create a unique filename by md5 hashing.
$counter = 0;
do {
    $filename = md5(date('U') . $raw . (++$counter)) . ".$save_format";
} while (file_exists("sounds/$filename"));

file_put_contents("sounds/$filename", $raw);

// Will generate the correct link to the saved audio file.
$link = substr($_SERVER["PHP_SELF"], 0, strrpos($_SERVER["PHP_SELF"], "/"));
$link = "$HOSTNAME$link/sounds/$filename";

echo $link;
?>
```

# Development

AuO is currently developed and maintained by William Qian as part of his Master of Engineering
thesis project with Daniel Wendel and Eric Klopfer in the MIT Scheller Teacher Education Program.

Bugs and issues should be reported in the GitHub issues page for AuO at
https://github.com/wqian94/AuO/issues along with any helpful information that you can provide, such
as operating system, browser (name and version), and any screenshots or videos that can help
recreate the bug.

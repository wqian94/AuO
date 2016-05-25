AuO version 0.3 (beta)
===
AuO, a browser-based audio recording and editing application. Uses browser-native technologies to
avoid third-party dependencies.

# Using AuO

Include AuO in any application by including AuO.js. Then, create an instance with

```javascript
const auo = new AuO(link_to_server_url);
```

where link_to_server is the URL to upload audio clips. Ignore this parameter to disable online
saving.

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

# The AuO User Interface

AuO currently supports audio recording, playback, editing, and saving. Currently, there is no
support for loading from and saving to a local file, or saving to any format other than webm. In
addition, the user can also zoom in and out to focus on parts of the audio clip. At the moment, AuO
supports up to 16 levels of zoom, for a total magnification of approximately 18.5 times the
original view of the waveform.

## Initial Launch

When AuO first launches, the user will see only the options to record and zoom, since AuO has not
captured any audio data yet. The first thing the user should do at this stage is click the `Record`
button.

## Audio Recording

By clicking the `Record` button, the user can begin to gather audio feed live from the computer's
microphone, or potentially other connected audio recording devices as well. For first-time users, a
dialog box should appear in the browser to request permission to access the audio recording device,
and choose a device if the computer has multiple available devices. If this dialog box does not
appear, make sure that the browser's URL points to an `http://` URL and not a `file://` URL.

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

In the idle state, the user can trim the audio clip from either end, as well as reposition the
ticker to begin playback at different parts of the audio recording.

## Ticker

The ticker is the red bar on the graph. This represents where AuO will begin playing the audio
recording when the user clicks `Play`. By moving this bar around, the user can allow AuO to begin
playing at different locations in the recording.

## Trimming Boxes

At either end of the graph, there is a blue box with an arrow pointing toward the graph. These are
the trimming boxes. The one on the left is the start-trimming box, and the one on the right is the
end-trimming box. These boxes represent the start and end of the trimmed audio recording,
respectively, and if one were to save the recording, the produced audio clip will contain only the
audio between the two boxes.

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
box that pops up when the saving has succeeded.

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

$raw = file_get_contents('php://input');

// Create a unique filename by md5 hashing.
$counter = 0;
do {
    $filename = md5(date('U') . $raw . (++$counter)) . ".webm";
} while (file_exists("sounds/$filename"));

file_put_contents("sounds/$filename", $raw);

// Will generate the correct link to the saved audio file.
$link = substr($_SERVER["PHP_SELF"], 0, strrpos($_SERVER["PHP_SELF"], "/"));
$link = "$HOSTNAME$link/sounds/$filename";

echo $link;
?>
```

AuO version 0.1 (beta)
===
AuO, a browser-based audio recording and editing application. Uses browser-native technologies to
avoid third-party dependencies.

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

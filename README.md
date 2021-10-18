dStream.. DusteDs streamer
====
![](https://github.com/DusteDdk/dstream/blob/master/screen.gif)
- Simple access to your music collection from the web browser
- Fast fuzzy search
- For semi-organized music collections
- Low resource usage, sqlite database
- single active process (node)
- totally a halfhearted hack, except for this markup file that I did spend a lot of time making

Infrastructure
====
- Music collection available on the server
- Docker
- Front-end, like nginx for handling HTTPS and authentication, it listens on port 3000
- Don't expose it to the Internet without some authentication in front, unless you want to share your collection with the world

Running
====
I assume you know how to use docker, remove the params you don't want.

docker run --restart=always -d -v /your/music:/music:ro -v /permanent/database/:/db:rw -e USER_ID=9000 -e GROUP_ID=9000 dusted/dstream:latest

The /db mount is optional, without it, the music database is lost if the container is removed.
The USER_ID and GROUP_ID variables are optional, if not provided, the default of 1000 is used.

Scanning music
====
Adds any music files in the music directory to the searchable database
1. Log into the website
2. press h
3. Click link "/scan to control music scanning"
4. Click "Scan" and wait.. press refresh if you're impatient,
5. It's done with "Scan" appears again, go back, you're done.

Using
====
Press J or click text-box
search
press enter to play top result or add from results

Add track to queue
----
Press song-name / file name to add to queue
Click row left of it to autoplay from there if song is last in queue.
Click row right of it to remove currently playing song and play this instead.

Remove track from queue
----
Click on file name to remove a song from queue
Pressing the "insert" key removes the current song from queue

Misc
----
Press the H key to show or hide the instructions

Why?
====
This bespoke interface was hacked to do just what I want, how I want,
maybe it won't fit you, but it fits me perfectly.

Source?
====
https://github.com/DusteDdk/dstream

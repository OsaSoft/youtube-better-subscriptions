function onVideoPage() {
    if (settings["settings.hide.watched.auto.store"]) {
        let videoId = new URL(window.location.href).searchParams.get("v");

        log("Marking video " + videoId + " as watched from video page");
        setVideoInStorage(videoId);
    }
}

function onVideoPage() {
    if (settings["settings.hide.watched.auto.store"]) {
        let videoId = new URL(window.location.href).searchParams.get("v");

        log("Marking video " + videoId + " as watched from video page");
        watchVideo(videoId);
        syncWatchedVideos();
    }
}

function onShortPage() {
    if (settings["settings.hide.watched.auto.store"]) {
        let videoId = getCurrentPage().split('/')[2];

        log("Marking short " + videoId + " as watched from shorts page");
        watchVideo(videoId);
        syncWatchedVideos();
    }
}

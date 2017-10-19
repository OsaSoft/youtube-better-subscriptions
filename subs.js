var delaySeconds = 3000;
var hidden = [];
var newLayout = document.querySelectorAll(".feed-item-container .yt-shelf-grid-item").length == 0;

function isWatched(item) {
    return (!newLayout &&
        (item.getElementsByClassName("watched").length > 0 ||
            item.getElementsByClassName("contains-percent-duration-watched").length > 0)) ||
        (newLayout &&
            (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 ||
                item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0))
}

function removeWatched() {
    hidden = [];

    var els = newLayout ? document.querySelectorAll("ytd-grid-video-renderer.style-scope.ytd-grid-renderer") : document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");

    [].forEach.call(els, function (item) {
        if (isWatched(item)) {
            hidden.push(item);
            item.style.display = 'none';
        }
    });
}

function showWatched() {
    hidden.forEach(function (it) {
        it.style.display = '';
    });
    hidden = [];
}

function checkboxChange() {
    var checkbox = document.getElementById("subs-grid");
    if (checkbox.checked) {
        removeWatched();
    } else {
        showWatched();
    }
}

function addButton() {
    var subGridLi;
    if (!newLayout) {
        subGridLi = document.createElement("li");
        subGridLi.setAttribute("class", "yt-uix-menu-top-level-button yt-uix-menu-top-level-flow-button");
    } else {
        subGridLi = document.createElement("div");
        subGridLi.setAttribute("style", "position: fixed;bottom: 0;margin: auto;left:50%;padding:10px;text-align: center; z-index:9999;border: 5px;background: rgba(25, 25, 25, .3);");
    }
    subGridLi.appendChild(document.createTextNode("Hide watched"));

    var subGridCheckbox = document.createElement("input");
    subGridCheckbox.setAttribute("id", "subs-grid");
    subGridCheckbox.setAttribute("type", "checkbox");
    subGridCheckbox.checked = true;

    subGridLi.appendChild(subGridCheckbox);

    if (!newLayout) {
        var feed = newLayout ? document.body :
            document.getElementsByClassName("yt-uix-menu-container feed-item-action-menu");
        if (feed.length > 0) { //just in case
            feed[0].insertBefore(subGridLi, feed[0].firstChild);
        }
    } else {
        document.body.appendChild(subGridLi);
    }
    var messenger = document.getElementById("subs-grid");
    messenger.addEventListener("change", checkboxChange);
}

addButton();

var intervalID = window.setInterval(function () {
    if (document.getElementById("subs-grid").checked) {
        removeWatched();
    }
}, delaySeconds);

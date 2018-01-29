var delaySeconds = 3000; //TODO: configurable?
var hidden = [];
var newLayout = document.querySelectorAll(".feed-item-container .yt-shelf-grid-item").length == 0; //is it the new (~fall 2017) YT layout?

function isWatched(item) {
    return (!newLayout &&
        (item.getElementsByClassName("watched").length > 0 ||
            item.getElementsByClassName("contains-percent-duration-watched").length > 0)) || //has "WATCHED" on thumbnail
        (newLayout &&
            (item.querySelectorAll("yt-formatted-string.style-scope.ytd-thumbnail-overlay-playback-status-renderer").length > 0 || //has "WATCHED" on thumbnail
                item.querySelectorAll("#progress.style-scope.ytd-thumbnail-overlay-resume-playback-renderer").length > 0) || //has progress bar on thumbnail
            item.hasAttribute("is-dismissed")) //also hide empty blocks left in by pressing "HIDE" button
}

function removeWatched() {
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
    var subGridButtonContainer;
    if (newLayout) { //is new layout?
        subGridButtonContainer = document.createElement("h2");
        subGridButtonContainer.setAttribute("class", "style-scope ytd-shelf-renderer");
    } else {
        subGridButtonContainer = document.createElement("li");
        subGridButtonContainer.setAttribute("class", "yt-uix-menu-top-level-button yt-uix-menu-top-level-flow-button");
    }

    subGridButtonContainer.appendChild(document.createTextNode("Hide watched")); //TODO: translations

    var subGridCheckbox = document.createElement("input");
    subGridCheckbox.setAttribute("id", "subs-grid");
    subGridCheckbox.setAttribute("type", "checkbox");
    subGridCheckbox.checked = true;

    subGridButtonContainer.appendChild(subGridCheckbox);

    var feed;
    if (newLayout) { //is new layout?
        var buttonMenu = document.querySelectorAll("#title-container #menu");
        if (buttonMenu) {
            buttonMenu = buttonMenu[0].firstChild;
        }
        feed = buttonMenu ? buttonMenu : document.body;
    } else {
        feed = document.getElementsByClassName("yt-uix-menu-container feed-item-action-menu");
    }

    if (feed.length > 0) { //just in case
        feed[0].insertBefore(subGridButtonContainer, feed[0].firstChild);
    } else {
        feed.insertBefore(subGridButtonContainer, feed.childNodes[0]); //appendChild(subGridButtonContainer);
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

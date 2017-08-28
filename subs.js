var hidden = [];

function removeWatched() {
    hidden = [];

    console.log("dfd");

    var els = document.querySelectorAll(".feed-item-container .yt-shelf-grid-item");
    [].forEach.call(els, function (item) {
        if (item.getElementsByClassName("watched").length > 0 ||
        item.getElementsByClassName("contains-percent-duration-watched").length > 0) {
            hidden.push(item);
            item.style.display = 'none';
        }
    });
}

function showWatched() {
    hidden.forEach(function (it) {
        it.style.display = '';
    });
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
    var subGridLi = document.createElement("li");
    subGridLi.setAttribute("class", "yt-uix-menu-top-level-button yt-uix-menu-top-level-flow-button");
    subGridLi.appendChild(document.createTextNode("Hide watched"));

    var subGridCheckbox = document.createElement("input");
    subGridCheckbox.setAttribute("id", "subs-grid");
    subGridCheckbox.setAttribute("type", "checkbox");
    subGridCheckbox.checked = true;

    subGridLi.appendChild(subGridCheckbox);

    var feed = document.getElementsByClassName("yt-uix-menu-container feed-item-action-menu");
    if (feed.length > 0) { //just in case
        feed[0].insertBefore(subGridLi, feed[0].firstChild);

        var messenger = document.getElementById("subs-grid");
        messenger.addEventListener("change", checkboxChange);
    }
}

addButton();
removeWatched();

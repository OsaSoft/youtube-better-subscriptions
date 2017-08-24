var hidden = [];

function removeWatched() {
    hidden = [];

    $(".feed-item-container .yt-shelf-grid-item").each(function () {
        var item = $(this);
        if (item.find(".watched").length > 0 ||
            item.find(".contains-percent-duration-watched").length > 0 ||
            item.find(".replace-enclosing-action-message").is(":visible")) {

            hidden.push(item);
            item.hide();
        }
    });
}

function showWatched() {
    hidden.forEach(function (it) {
        it.show();
    });
}

function checkboxChange() {
    var checkbox = $("#subs-grid");
    if (checkbox.is(":checked")) {
        removeWatched();
    } else {
        showWatched();
    }
}

function addButton() {
    var html = "<li class='yt-uix-menu-top-level-button yt-uix-menu-top-level-flow-button'>" +
        "Hide watched <input id='subs-grid' type='checkbox' checked/>" +
        "</li>";

    $(".yt-uix-menu-container.feed-item-action-menu").prepend(html);

    var messenger = document.getElementById("subs-grid");
    messenger.addEventListener("change", checkboxChange);
}

addButton();
removeWatched();
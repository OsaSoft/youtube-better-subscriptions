class SubscriptionVideo extends Video {
    constructor(containingDiv) {
        super(containingDiv);

        // Try old layout selector
        this.contentDiv = this.containingDiv.querySelector(".ytd-rich-item-renderer, ytd-video-renderer.style-scope.ytd-expanded-shelf-contents-renderer");

        // Try new January 2026 lockupViewModel layout
        if (!this.contentDiv) {
            this.contentDiv = this.containingDiv.querySelector("lockup-view-model, yt-lockup-view-model");
        }
    }

    hasButton() {
        let button = this.contentDiv ? this.contentDiv.querySelector("#" + this.buttonId) : null;
        if (!button) {
            return false;
        }
        // Compact layout: a button that fell back to the bottom row because YouTube hadn't built the
        // ⋮ yet counts as missing once the ⋮ exists, so the next scan moves it there.
        return !(button.closest(".subs-btn-container--bottom") && this.usesCompactButton() && this.getMenuButtonDiv());
    }

    // Whether the button goes under the lockup's ⋮ (compact setting on, vertical lockup card)
    usesCompactButton() {
        return Boolean(settings["settings.mark.watched.button.compact"]
                && !settings["settings.hide.mark.watched.button"]
                && this.getVerticalDiv());
    }

    // Whether the compact button can't be placed yet because YouTube hasn't built the ⋮
    awaitsMenuButton() {
        return this.usesCompactButton() && !this.getMenuButtonDiv();
    }

    // Same lookups as addButton()
    getVerticalDiv() {
        return this.contentDiv
                ? this.contentDiv.querySelector(".ytLockupViewModelVertical, .yt-lockup-view-model--vertical")
                : null;
    }

    getMenuButtonDiv() {
        let verticalDiv = this.getVerticalDiv();
        return verticalDiv
                ? verticalDiv.querySelector(".ytLockupMetadataViewModelMenuButton, .yt-lockup-metadata-view-model__menu-button")
                : null;
    }

    // The text column of a horizontal lockup row (playlist pages, #209), or null on other layouts
    getRowTextDiv() {
        return this.contentDiv
                ? this.contentDiv.querySelector(
                        ".ytLockupViewModelHorizontal .ytLockupMetadataViewModelTextContainer, " +
                        ".yt-lockup-view-model--horizontal .yt-lockup-metadata-view-model__text-container")
                : null;
    }

    // The element faded while the video is marked watched (the whole card on lockup layouts). On the
    // old layouts it's also where addButton() puts the button. Every path that builds a mark/unmark
    // button passes this one, so marking by click and loading as watched fade the same element.
    getFadeTarget() {
        if (!this.contentDiv) {
            return null;
        }

        if (this.contentDiv.matches('lockup-view-model, yt-lockup-view-model')) {
            return this.contentDiv;
        }

        return this.contentDiv.firstElementChild;
    }

    addButton() {
        // Check if button should be hidden
        if (settings["settings.hide.mark.watched.button"]) {
            return;
        }

        if (!this.contentDiv) {
            return;
        }

        // A button for the other state means the watched state changed elsewhere (another tab or
        // device): replace it rather than adding a second one.
        this.contentDiv.querySelectorAll(".subs-btn-container").forEach(e => e.remove());

        // Find the container for building the button
        let buttonContainer = this.getFadeTarget();

        if (!buttonContainer) {
            return;
        }

        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        let markButton = buildMarkWatchedButton(buttonContainer, this.containingDiv, this.videoId, !this.isStored);

        // Insert button in a container
        let container = document.createElement("div");
        container.classList.add("subs-btn-container");
        container.appendChild(markButton);

        // Horizontal lockup row (playlist pages): below the title, channel and views, clear of the ⋮,
        // which has a column of its own to the right of the text
        let rowTextDiv = this.getRowTextDiv();
        if (rowTextDiv) {
            container.classList.add("subs-btn-container--row");
            rowTextDiv.appendChild(container);
            return;
        }

        // Detect new lockup layout by presence of vertical container. YouTube renamed the lockup
        // classes from dashed BEM (yt-lockup-view-model--vertical) to camelCase
        // (ytLockupViewModelVertical); some users may still get the dashed ones.
        let verticalDiv = this.contentDiv.querySelector(".ytLockupViewModelVertical, .yt-lockup-view-model--vertical");
        if (verticalDiv) {
            let menuButtonDiv = settings["settings.mark.watched.button.compact"]
                ? verticalDiv.querySelector(".ytLockupMetadataViewModelMenuButton, .yt-lockup-metadata-view-model__menu-button")
                : null;
            if (menuButtonDiv) {
                // Compact layout: place inside a wrapper to avoid position:relative on flex item (Firefox bug)
                container.classList.add("subs-btn-container--compact");
                let wrapper = menuButtonDiv.querySelector(".subs-btn-compact-wrapper");
                if (!wrapper) {
                    wrapper = document.createElement("div");
                    wrapper.classList.add("subs-btn-compact-wrapper");
                    while (menuButtonDiv.firstChild) {
                        wrapper.appendChild(menuButtonDiv.firstChild);
                    }
                    menuButtonDiv.appendChild(wrapper);
                }
                wrapper.appendChild(container);
            } else {
                // Default layout: below the card's metadata, after the lockup host rather than inside
                // it, where YouTube's touch-feedback overlay would sit on top of the button. subs.css
                // stretches the lockup and pushes the container to the bottom so a row lines up.
                container.classList.add("subs-btn-container--bottom");
                verticalDiv.after(container);
            }
        } else {
            // Old layout: insert before title area
            let refNode = buttonContainer.querySelector("#video-title")?.parentElement;
            if (refNode?.parentElement !== buttonContainer) {
                // Channel page layout: #video-title is deeply nested, insert into #meta area
                let metaDiv = buttonContainer.querySelector("#meta");
                if (metaDiv) {
                    metaDiv.appendChild(container);
                } else {
                    buttonContainer.appendChild(container);
                }
            } else {
                buttonContainer.insertBefore(container, refNode || buttonContainer.firstChild);
            }
        }
    }
}

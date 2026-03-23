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
        return this.contentDiv && this.contentDiv.querySelector("#" + this.buttonId) != null
    }

    addButton() {
        // Check if button should be hidden
        if (settings["settings.hide.mark.watched.button"]) {
            return;
        }

        if (!this.contentDiv) {
            return;
        }

        let firstChild = this.contentDiv.firstElementChild;
        let isListView = firstChild && firstChild.nodeType === Node.COMMENT_NODE;

        // Find the container for building the button
        let buttonContainer;
        if (this.contentDiv.matches('lockup-view-model, yt-lockup-view-model')) {
            buttonContainer = this.contentDiv;
        } else {
            buttonContainer = isListView ? this.contentDiv.querySelector(".text-wrapper.style-scope.ytd-video-renderer") : firstChild;
        }

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

        // Detect new lockup layout by presence of vertical container
        let verticalDiv = this.contentDiv.querySelector(".yt-lockup-view-model--vertical");
        if (verticalDiv) {
            let menuButtonDiv = settings["settings.mark.watched.button.compact"]
                ? verticalDiv.querySelector(".yt-lockup-metadata-view-model__menu-button")
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
                // Default layout: insert after metadata div
                let metadataDiv = verticalDiv.querySelector(":scope > .yt-lockup-view-model__metadata");
                if (metadataDiv) {
                    metadataDiv.after(container);
                } else {
                    verticalDiv.appendChild(container);
                }
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

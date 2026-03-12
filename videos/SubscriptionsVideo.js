class SubscriptionVideo extends Video {
    constructor(containingDiv) {
        super(containingDiv);

        // Try old layout selector
        this.contentDiv = this.containingDiv.querySelector(".ytd-rich-item-renderer, ytd-video-renderer.style-scope.ytd-expanded-shelf-contents-renderer");

        // Try new January 2026 lockupViewModel layout
        if (!this.contentDiv) {
            this.contentDiv = this.containingDiv.querySelector("lockup-view-model");
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

        let firstChild = this.contentDiv.firstChild;
        let isListView = firstChild && firstChild.nodeType === Node.COMMENT_NODE;

        // Find the container for building the button
        let buttonContainer;
        if (this.contentDiv.tagName === 'LOCKUP-VIEW-MODEL') {
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

        // Insert button in a strip between thumbnail and metadata
        let strip = document.createElement("div");
        strip.classList.add("subs-btn-strip");
        strip.appendChild(markButton);

        // Detect new lockup layout by presence of vertical container
        let verticalDiv = this.contentDiv.querySelector(".yt-lockup-view-model--vertical");
        if (verticalDiv) {
            // New layout: insert after metadata div (below description)
            let metadataDiv = verticalDiv.querySelector(":scope > .yt-lockup-view-model__metadata");
            if (metadataDiv) {
                metadataDiv.after(strip);
            } else {
                verticalDiv.appendChild(strip);
            }
        } else {
            // Old layout: insert before title area
            buttonContainer.insertBefore(strip, buttonContainer.querySelector("#video-title")?.parentElement || buttonContainer.firstChild);
        }
    }
}

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
        if (!this.contentDiv) {
            return;
        }

        let firstChild = this.contentDiv.firstChild;
        let isListView = firstChild && firstChild.nodeType === Node.COMMENT_NODE;

        // For new lockupViewModel layout, find the metadata container
        let buttonContainer;
        if (this.contentDiv.tagName === 'LOCKUP-VIEW-MODEL') {
            // New layout: put button in the metadata area
            buttonContainer = this.contentDiv.querySelector("lockup-metadata-view-model") ||
                            this.contentDiv.querySelector(".metadata") ||
                            this.contentDiv;
        } else {
            // Old layout
            buttonContainer = isListView ? this.contentDiv.querySelector(".text-wrapper.style-scope.ytd-video-renderer") : firstChild;
        }

        if (!buttonContainer) {
            return;
        }

        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        let markButton = buildMarkWatchedButton(buttonContainer, this.containingDiv, this.videoId, !this.isStored);
        buttonContainer.appendChild(markButton);
    }
}

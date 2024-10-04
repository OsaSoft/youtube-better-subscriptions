class SubscriptionVideo extends Video {
    constructor(containingDiv) {
        super(containingDiv);
        this.contentDiv = this.containingDiv.querySelector(".ytd-rich-item-renderer, ytd-video-renderer.style-scope.ytd-expanded-shelf-contents-renderer");
    }

    hasButton() {
        return this.contentDiv && this.contentDiv.querySelector("#" + this.buttonId) != null
    }

    addButton() {
        if (!this.contentDiv) {
            return;
        }

        let firstChild = this.contentDiv.firstChild;
        let isListView = firstChild.nodeType === Node.COMMENT_NODE;

        let buttonContainer = isListView ? this.contentDiv.querySelector('.text-wrapper.style-scope.ytd-video-renderer') : firstChild;

        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        let markButton = buildMarkWatchedButton(buttonContainer, this.containingDiv, this.videoId, !this.isStored);
        buttonContainer.appendChild(markButton);
    }
}

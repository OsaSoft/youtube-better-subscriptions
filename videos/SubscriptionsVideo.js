class SubscriptionVideo extends Video {
    constructor(containingDiv) {
        super(containingDiv);
        this.contentDiv = this.containingDiv.querySelector(".ytd-rich-item-renderer");
    }

    hasButton() {
        return this.contentDiv.querySelector("#" + this.buttonId) != null
    }

    addButton() {
        let buttonContainer = this.contentDiv.firstChild;
        // stored = false - build "Mark as watched"
        // stored = true  - build "Mark as unwatched"
        let markButton = buildMarkWatchedButton(buttonContainer, this.containingDiv, this.videoId, !this.isStored);
        buttonContainer.appendChild(markButton);
    }
}

let intervalTweakId = null;

async function initTweaks(){

    initTweakUI();
    intervalTweakId = window.setInterval(function() {
        applyTweakUpdates()
    }
}

function hideSelector(selector){
    document.querySelector(selector).style.display = 'none';
}

function initTweakUI(){
    hideSelector(headerCenterQuery());
    hideSelector(headerLogoQuery());
}

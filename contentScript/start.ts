import {startExtension} from '.';
import {getPort, setLocalWatchHistory} from './common';
import {setLocalSettings} from './settings';

getPort().onMessage.addListener((message) => {
    if (message.type === 'settings') {
        setLocalSettings(message.settings);

        startExtension();
    }
    else if (message.type === 'watchHistory') {
        setLocalWatchHistory(message.watchHistory);
    }
});

getPort().postMessage({type: 'getSettings'});
getPort().postMessage({type: 'getWatchHistory'});

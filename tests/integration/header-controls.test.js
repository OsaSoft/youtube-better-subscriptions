/**
 * The extension's header controls on the subscriptions feed: the "Hide watched" toggle and label,
 * "Mark all as watched" and the settings button (the elements in addedElems).
 */

const vm = require('vm');
const { loadUtil, loadQueries, loadSubscriptionsVideo, loadSubsUI } = require('../helpers/load-source');

const PREFIX = "osasoft-better-subscriptions_";
const CONTROL_IDS = [
    PREFIX + "hide-watched-toggle-label",
    PREFIX + "hide-watched-toggle",
    PREFIX + "subs-grid-menu-mark-all",
    PREFIX + "subs-grid-menu-settings",
];
const STOP_BUTTON = "#" + PREFIX + "stop-loading-older";
const STOP_ATTR = PREFIX + "stop-loading";

describe('header controls', () => {
    let ui;

    function setup(html) {
        document.body.innerHTML = html;
        global.isSubscriptionsPage = () => true;
        global.getCurrentPage = () => '/feed/subscriptions';
        loadUtil();
        loadQueries();
        loadSubscriptionsVideo();
        ui = loadSubsUI();
    }

    const controls = () => CONTROL_IDS.map(id => document.getElementById(id)).filter(Boolean);

    describe('when YouTube has no place for them', () => {
        test.each([true, false])('buildUI does not throw (stick right: %s)', (stickRight) => {
            settings["settings.hide.watched.ui.stick.right"] = stickRight;
            setup('<div id="page"></div>');

            expect(() => ui.buildUI()).not.toThrow();
            expect(controls()).toHaveLength(0);
            expect(vm.runInContext('addedElems', ui)).toHaveLength(0);
        });

        test('the stop-loading button is still added and works', () => {
            setup('<div id="page"></div>');
            ui.buildUI();

            const button = document.querySelector(STOP_BUTTON);
            expect(button).not.toBeNull();
            button.click();
            expect(document.documentElement.hasAttribute(STOP_ATTR)).toBe(true);
        });
    });

    test('with a place, buildUI adds all four controls there', () => {
        setup('<ytd-browse page-subtype="subscriptions"><div id="primary"></div></ytd-browse>');
        ui.buildUI();

        expect(controls()).toHaveLength(4);
        controls().forEach(control => expect(control.parentNode.tagName).toBe('YTD-BROWSE'));
    });
});

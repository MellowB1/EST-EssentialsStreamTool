/**
 * Team overlay presets — browser IIFE mirror.
 * Keep in sync with: src/shared/team-presets.js
 *                   src/renderer/js/team-presets.js
 */
(function (global) {
    var TEAM_PRESETS = [
        { id: 'team-h-full',              folder: 'party-h-full',              layout: 'horizontal', info: 'full',        plain: false },
        { id: 'team-h-full-plain',        folder: 'party-h-full-plain',        layout: 'horizontal', info: 'full',        plain: true  },
        { id: 'team-h-sprite',            folder: 'party-h-sprite',            layout: 'horizontal', info: 'sprite',      plain: false },
        { id: 'team-h-sprite-plain',      folder: 'party-h-sprite-plain',      layout: 'horizontal', info: 'sprite',      plain: true  },
        { id: 'team-v-name',              folder: 'party-v-name',              layout: 'vertical',   info: 'name',        plain: false },
        { id: 'team-v-name-plain',        folder: 'party-v-name-plain',        layout: 'vertical',   info: 'name',        plain: true  },
        { id: 'team-v-sprite',            folder: 'party-v-sprite',            layout: 'vertical',   info: 'sprite',      plain: false },
        { id: 'team-v-sprite-plain',      folder: 'party-v-sprite-plain',      layout: 'vertical',   info: 'sprite',      plain: true  },
        { id: 'team-v-sprite-name',       folder: 'party-v-sprite-name',       layout: 'vertical',   info: 'sprite-name', plain: false },
        { id: 'team-v-name-below',        folder: 'party-v-name-below',        layout: 'vertical',   info: 'sprite-name', plain: true  },
        { id: 'team-2col-sprite',         folder: 'party-2col-sprite',         layout: '2col',       info: 'sprite',      plain: false },
        { id: 'team-2col-sprite-plain',   folder: 'party-2col-sprite-plain',   layout: '2col',       info: 'sprite',      plain: true  },
        { id: 'team-3col-sprite-bg',      folder: 'party-3col-sprite-bg',      layout: '3col',       info: 'sprite',      plain: false },
        { id: 'team-3col-sprite',         folder: 'party-3col-sprite',         layout: '3col',       info: 'sprite',      plain: true  },
        { id: 'team-stair-sprite-bg',      folder: 'party-stair-sprite-bg',      layout: 'stair',      info: 'sprite', plain: false },
        { id: 'team-stair-sprite',         folder: 'party-stair-sprite',         layout: 'stair',      info: 'sprite', plain: true  },
        { id: 'team-stair-left-sprite-bg', folder: 'party-stair-left-sprite-bg', layout: 'stair-left', info: 'sprite', plain: false },
        { id: 'team-stair-left-sprite',    folder: 'party-stair-left-sprite',    layout: 'stair-left', info: 'sprite', plain: true  },
        { id: 'team-circle-sprite',        folder: 'party-circle-sprite',        layout: 'circle',     info: 'sprite', plain: false },
        { id: 'team-circle-sprite-plain',  folder: 'party-circle-sprite-plain',  layout: 'circle',     info: 'sprite', plain: true  },
        { id: 'team-h-hp',                 folder: 'party-h-hp',                 layout: 'horizontal', info: 'hp',        plain: false },
        { id: 'team-h-hp-plain',           folder: 'party-h-hp-plain',           layout: 'horizontal', info: 'hp',        plain: true  },
        { id: 'team-v-sprite-hp',          folder: 'party-v-sprite-hp',          layout: 'vertical',   info: 'sprite-hp', plain: false },
        { id: 'team-v-sprite-hp-plain',    folder: 'party-v-sprite-hp-plain',    layout: 'vertical',   info: 'sprite-hp', plain: true  },
    ];

    global.EST_TEAM_PRESETS = TEAM_PRESETS;
})(typeof window !== 'undefined' ? window : this);

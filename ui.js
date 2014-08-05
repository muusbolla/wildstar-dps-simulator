/**
 * Contains the UI generating code. Uses Backbone.js to encapsulate views and models, and stores
 * the current stats as a serialized BuildModel in local storage.
 */
(function(){
    var STAT_INPUT_BOUNDS = {
        assaultPower: {
            MIN: 1,
            MAX: 10000,
            STEP: 10
        },
        supportPower: {
            MIN: 1,
            MAX: 10000,
            STEP: 10
        },
        critHitChance: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        },
        critHitSeverity: {
            MIN: 1.5,
            MAX: 2.2,
            STEP: 0.01
        },
        strikeThroughChance: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        },
        cooldownReduction: {
            MIN: 0,
            MAX: 0.15,
            STEP: 0.01
        },
        armorPierce: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        },
        fightDuration: {
            MIN: 10,
            MAX: 1000,
            STEP: 10
        },
        enemyMitigation: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        },
        enemyDeflectChance: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        },
        ckT8Effectiveness: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        },
        enablerEffectiveness: {
            MIN: 0,
            MAX: 1,
            STEP: 0.01
        }
    };

    var SimModel = Backbone.Model.extend({
        toJSON: function(){
            var json = SimModel.__super__.toJSON.apply(this, arguments);
            return Object.keys(json).reduce(function(result, key){
                var value = json[key];
                if (typeof value === 'string' && !isNaN(value)){
                    value = parseFloat(value);
                }
                result[key] = value;
                return result;
            }, {});
        }
    });

    var StatsModel = SimModel.extend({
        defaults: {
            assaultPower: 2500,
            supportPower: 600,
            critHitChance: 0.19,
            critHitSeverity: 1.83,
            strikeThroughChance: 0.07,
            cooldownReduction: 0.15,
            armorPierce: 0.00,
            fightDuration: 180,
            enemyMitigation: 0.3,
            enemyDeflectChance: 0.12,
            ckT8Effectiveness: 0.8,
            enablerEffectiveness: 0.8
        }
    });

    var ActionSetModel = SimModel.extend({
        defaults: {
            shred: 8,
            impale: 8,
            analyzeWeakness: 0,
            punish: 2,
            ruin: 4,
            concussiveKicks: -1,
            collapse: 0,
            stagger: 0,
            preparation: 0,
            tacticalRetreat: -1
        }
    });

    var AmpsModel = SimModel.extend({
        defaults: {
            killerInstinct: false,
            onslaught: true,
            fatalWounds: true,
            stealthMastery: false,
            unfairAdvantage: true,
            riposte: true,
            enabler: true,
            cutthroat: true,
            devastate: false,
            brutalityMastery: true
        }
    });

    var BuildModel = Backbone.Model.extend({
        defaults: {
            stats: null,
            actionSet: null,
            amps: null
        },

        initialize: function(options){
            this.set({
                stats: new StatsModel(),
                actionSet: new ActionSetModel(),
                amps: new AmpsModel()
            });
        },

        isNew: function(){
            return false;
        },

        toJSON: function(){
            var json = Backbone.Model.prototype.toJSON.call(this);

            return {
                stats: json.stats && json.stats.toJSON(),
                actionSet: json.actionSet && json.actionSet.toJSON(),
                amps: json.amps && json.amps.toJSON(),
            };
        },

        sync: function(method, model, options){
            if (method === 'update' || method === 'create'){
                var json = this.toJSON();
                var result = JSON.stringify(json);
                localStorage['stalkerBuild'] = result;
                options.success();
            } else {
                var json = localStorage['stalkerBuild'];
                options.success(json);
            }
        },

        parse: function(response){
            if (!response){
                return {};
            }
            response = JSON.parse(response || {});

            return {
                stats: new StatsModel(response.stats || {}),
                actionSet: new ActionSetModel(response.actionSet || {}),
                amps: new AmpsModel(response.amps || {})
            };
        }
    });
    var stalkerBuild = new BuildModel();
    stalkerBuild.fetch();

    // Debounce saves so they happen half a second after changes stop being made.
    var saveStalker = function(){
        if (saveStalker.timeout){
            clearTimeout(saveStalker.timeout);
        }
        saveStalker.timeout = setTimeout(function(){
            stalkerBuild.save();
            saveStalker.timeout = null;
        }, 100);
    }

    var ActionSetView = Backbone.View.extend({
        events: {
            'input input': 'skillChanged'
        },

        render: function(){
            var div = document.createElement('div');
            Object.keys(ActionSetModel.prototype.defaults).forEach(function(name){
                var label = document.createElement('label');
                var value = stalkerBuild.get('actionSet').get(name);
                label.innerHTML = '<span class="label-text">' + name +
                    '</span><input type="range" min="-1" max="8" step="1" value="' + value + '" data-name="' + name + '">' +
                    '<span class="preview">' + value + '</span>';
                div.appendChild(label);
            });
            this.setElement(div);
        },

        skillChanged: function(evt){
            var skillName = evt.target.dataset.name;
            var value = evt.target.value;
            stalkerBuild.get('actionSet').set(skillName, value);
            saveStalker();
            evt.target.parentElement.querySelector('.preview').textContent = value;
        }
    });

    var StatsView = Backbone.View.extend({
        events: {
            'input input': 'statChanged'
        },

        render: function(){
            var div = document.createElement('div');
            Object.keys(StatsModel.prototype.defaults).forEach(function(name){
                var label = document.createElement('label');
                var value = stalkerBuild.get('stats').get(name);
                var bounds = STAT_INPUT_BOUNDS[name];
                var limits = 'min="' + bounds.MIN + '" max="' + bounds.MAX + '" step="' + bounds.STEP + '"';
                label.innerHTML = '<span class="label-text">' + name + '</span>' + '<input type="number" value="' + value + '" data-name="' + name + '" ' + limits + '>';
                div.appendChild(label);
            });
            this.setElement(div);
        },

        statChanged: function(evt){
            var statName = evt.target.dataset.name;
            var bounds = STAT_INPUT_BOUNDS[statName];
            var value = bound(bounds.MIN, bounds.MAX, evt.target.value);
            evt.target.value = value;
            stalkerBuild.get('stats').set(statName, value);
            saveStalker();
        }
    });

    var AmpsView = Backbone.View.extend({
        events: {
            'change input': 'ampChanged'
        },

        render: function(){
            var div = document.createElement('div');
            Object.keys(AmpsModel.prototype.defaults).forEach(function(name){
                var label = document.createElement('label');
                var checked = stalkerBuild.get('amps').get(name) ? 'checked' : '';
                label.innerHTML = '<span class="label-text">' + name + '</span><input type="checkbox" ' + checked + ' name="' + name + '">';
                div.appendChild(label);
            });
            div.lastChild.lastChild.disabled = 'disabled';
            this.setElement(div);
        },

        ampChanged: function(evt){
            var ampName = evt.target.name;
            stalkerBuild.get('amps').set(ampName, !!evt.target.checked);
            saveStalker();
        }
    });

    function makeStalker(las, amps, stats){
        las = las || {};
        amps = amps || {};
        stats = stats || {};

        return {
            // Stats
            assaultPower: stats.assaultPower,
            supportPower: stats.supportPower,
            critHitChance: stats.critHitChance,
            critHitSeverity: stats.critHitSeverity,
            strikeThroughChance: stats.strikeThroughChance,
            cooldownReduction: stats.cooldownReduction,
            assaultCooldownReduction: 0,
            armorPierce: stats.armorPierce,
            ckT8Effectiveness: stats.ckT8Effectiveness,
            enablerEffectiveness: stats.enablerEffectiveness,
            // LAS info
            impale: las.impale,
            shred: las.shred,
            analyzeWeakness: las.analyzeWeakness,
            punish: las.punish,
            ruin: las.ruin,
            concussiveKicks: las.concussiveKicks,
            collapse: las.collapse,
            stagger: las.stagger,
            preparation: las.preparation,
            tacticalRetreat: las.tacticalRetreat,
            // AMPS info
            killerInstinct: amps.killerInstinct,
            onslaught: amps.onslaught,
            fatalWounds: amps.fatalWounds,
            stealthMastery: amps.stealthMastery,
            unfairAdvantage: amps.unfairAdvantage,
            riposte: amps.riposte,
            enabler: amps.enabler,
            cutthroat: amps.cutthroat,
            devastate: amps.devastate,
            // Target info
            enemyDeflectChance: stats.enemyDeflectChance,
            enemyMitigation: stats.enemyMitigation
        };
    }

    var SimView = Backbone.View.extend({
        initialize: function(){
            var debouncedRender = _.debounce(this.renderResults.bind(this), 50);
            this.listenTo(stalkerBuild.get('actionSet'), 'change', debouncedRender);
            this.listenTo(stalkerBuild.get('stats'), 'change', debouncedRender);
            this.listenTo(stalkerBuild.get('amps'), 'change', debouncedRender);
        },

        render: function(){
            this.actionSet_ = new ActionSetView();
            var las = this.el.querySelector('#las');
            las.innerHTML = '';
            this.actionSet_.render();
            las.appendChild(this.actionSet_.el);

            this.stats_ = new StatsView();
            var stats = this.el.querySelector('#stats');
            stats.innerHTML = '';
            this.stats_.render();
            stats.appendChild(this.stats_.el);

            this.amps_ = new AmpsView();
            var amps = this.el.querySelector('#amps');
            amps.innerHTML = '';
            this.amps_.render();
            amps.appendChild(this.amps_.el);

            this.renderResults();
        },

        renderResults: function(){
            var stalker = makeStalker(stalkerBuild.get('actionSet').toJSON(),
                stalkerBuild.get('amps').toJSON(),
                stalkerBuild.get('stats').toJSON());
            var duration = stalkerBuild.get('stats').get('fightDuration');

            var damage = Simulator.getDamage(stalker, duration);
            var html = '<table><tr><th>Ability</th><th>Damage</th><th>Hits</th><th>Crits</th><th>DPS</th></tr>';
            var abilities = damage.abilities.sort(function(a, b){
                return b.damage - a.damage;
            });
            abilities.forEach(function(ability){
                html += '<tr><td>' + ability.label + '</td><td>' + Math.floor(ability.damage) + '</td><td>' +
                    Math.floor(ability.hits) + '</td><td>' + Math.floor(ability.crits) + '</td><td>' +
                    Math.floor(ability.damage / duration) + '</td></tr>';
            });
            var summary = abilities.reduce(function(summary, ability){
                summary.damage += ability.damage;
                summary.hits += ability.hits;
                summary.crits += ability.crits;
                return summary;
            }, {
                damage: 0,
                hits: 0,
                crits: 0
            });
            html += '<tr class="summary"><td>Total</td>';
            ['damage', 'hits', 'crits'].forEach(function(name){
                html += '<td>' + Math.floor(summary[name]) + '</td>';
            });
            html += '<td>' + Math.floor(damage.dps) + '</td>';
            html += '</table><table><tr><th>Stat</th><th>Result</th></tr>';

            var fmt = function(x){
                return result = Math.floor(100 * x) / 100;
            }

            var fmtd = function(x){
                return fmt(x.dps - damage.dps);
            }

            var damageFromAssaultPower = Simulator.getDamageAfterChange(stalker, duration, {
                assaultPower: 10
            });
            var damageFromBrutality = Simulator.getDamageAfterChange(stalker, duration, {
                assaultPower: 13 / 2
            });
            var damageFromMoxie = Simulator.getDamageAfterChange(stalker, duration, {
                critHitChance: 5 / 6500,
                critSeverityRating: 5
            });
            var damageFromFinesse = Simulator.getDamageAfterChange(stalker, duration, {
                critSeverityRating: 5,
                strikeThroughChance: 5 / 13000
            });
            var damageFromCritRating = Simulator.getDamageAfterChange(stalker, duration, {
                critHitChance: (10 / 65) / 100
            });
            var damageFromSeverityRating = Simulator.getDamageAfterChange(stalker, duration, {
                critSeverityRating: 10
            });
            var damageFromStrikethroughRating = Simulator.getDamageAfterChange(stalker, duration, {
                strikeThroughChance: (10 / 130) / 100
            });
            var damageFromCritChance = Simulator.getDamageAfterChange(stalker, duration, {
                critHitChance: 0.01
            });
            var damageFromCritSeverity = Simulator.getDamageAfterChange(stalker, duration, {
                critHitSeverity: 0.01
            });
            var damageFromStrikethrough = Simulator.getDamageAfterChange(stalker, duration, {
                strikeThroughChance: 0.01
            });

            var severity = Simulator.severityRatingNeeded(stalker);
            html += '<tr><td>crit sev for 1%</td><td>' + fmt(severity) + ' rating</td></tr>';
            html += '<tr><td>1% crit chance</td><td>' + fmtd(damageFromCritChance) + ' DPS</td></tr>';
            html += '<tr><td>1% crit severity</td><td>' + fmtd(damageFromCritSeverity) + ' DPS</td></tr>';
            html += '<tr><td>1% strikethrough</td><td>' + fmtd(damageFromStrikethrough) + ' DPS</td></tr>';
            html += '<tr><td>10 assault power</td><td>' + fmtd(damageFromAssaultPower) + ' DPS (10 AP)</td></tr>';

            var dpsFromAP = damageFromAssaultPower.dps - damage.dps;
            var weight = function(d){
                return fmt(10 * ((d.dps - damage.dps) / dpsFromAP));
            };
            html += '<tr><td>10 brutality</td><td>' + fmtd(damageFromBrutality) +
                ' DPS (' + weight(damageFromBrutality) + ' AP)</td></tr>';
            html += '<tr><td>10 finesse</td><td>' + fmtd(damageFromFinesse) +
                ' DPS (' + weight(damageFromFinesse) + ' AP)</td></tr>';
            html += '<tr><td>10 moxie</td><td>' + fmtd(damageFromMoxie) +
                ' DPS (' + weight(damageFromMoxie) + ' AP)</td></tr>';
            html += '<tr><td>10 crit rating</td><td>' + fmtd(damageFromCritRating) +
                ' DPS (' + weight(damageFromCritRating) + ' AP)</td></tr>';
            html += '<tr><td>10 severity rating</td><td>' + fmtd(damageFromSeverityRating) +
                ' DPS (' + weight(damageFromSeverityRating) + ' AP)</td></tr>';
            html += '<tr><td>10 strikethrough rating</td><td>' + fmtd(damageFromStrikethroughRating) +
                ' DPS (' + weight(damageFromStrikethroughRating) + ' AP)</td></tr>';
            html += '</table>';

            this.el.querySelector('#output').innerHTML = html;
        }
    });

    var sim = new SimView({el: document.body});
    sim.render();
})();

/**
 * The Simulator is just a collection of methods that take a Stalker's build as input and compute
 * DPS information as output.
 *
 * Most of the Simulator's assumptions are configurable in Simulator.ABILITIES and Simulator.AMPS.
 * Actual ability/amp implementations are found in Simulator.getDamage.
 */
function bound(low, high, number){
    return Math.max(low, Math.min(high, number));
}

var Simulator = {};

/**
 * Abilities used for doing damage. Nano-skin Lethal is assumed and factored into the coefficients.
 * To remove this, divide the coefficient by 1.18, or 1.22 for abilities that deal tech damage, as
 * they still receive the pre-nerf bonus.
 */
Simulator.ABILITIES = {
    IMPALE: {
        GCD: 0.5,
        COOLDOWN: 0,
        TYPE: 'ASSAULT',
        SUIT_POWER_COST: 35,
        T8_SUIT_POWER_COST: 30,
        T4_ARMOR_PIERCE: 0.5,
        AP_BASE_COEFFICIENT: 0.944,
        AP_TIER_COEFFICIENT: 0.0472,
        BASE_DAMAGE: 2225.48,
        DAMAGE_TYPE: 'phys'
    },
    SHRED: {
        GCD: 1.05,
        COOLDOWN: 0,
        TYPE: 'ASSAULT',
        SUIT_POWER_COST: 0,
        HIT_COUNT: 3,
        AP_BASE_COEFFICIENT: 0.114106,
        AP_TIER_COEFFICIENT: 0.013924,
        BASE_DAMAGE: 293.7964,
        T4_ARMOR_PIERCE: 0.38,
        // Shred's SP regeneration is bugged and doesn't actually give 2 SP/s.
        T8_SPPS: 1.6,
        DAMAGE_TYPE: 'phys'
    },
    ANALYZE_WEAKNESS: {
        GCD: 0,
        COOLDOWN: 8,
        TYPE: 'ASSAULT',
        SUIT_POWER_COST: 15,
        AP_BASE_COEFFICIENT: 0.613904,
        AP_TIER_COEFFICIENT: 0.027694,
        BASE_DAMAGE: 1334.68,
        T4_SPPS: 2,
        T4_BUFF_DURATION: 5,
        T8_AVERAGE_CDR: 1.125,
        DAMAGE_TYPE: 'tech'
    },
    PUNISH: {
        GCD: 0,
        COOLDOWN: 8,
        TYPE: 'ASSAULT',
        SUIT_POWER_COST: 0,
        AP_BASE_COEFFICIENT: 0.64369,
        AP_TIER_COEFFICIENT: 0.08201,
        BASE_DAMAGE: 1400.66,
        SPPU: 30,
        T8_SPPU: 45,
        T4_EXPOSE: 1.045,
        DAMAGE_TYPE: 'phys'
    },
    RUIN: {
        GCD: 0.5,
        COOLDOWN: 11,
        TYPE: 'ASSAULT',
        SUIT_POWER_COST: 10,
        AP_BASE_COEFFICIENT: 0.167262,
        AP_TIER_COEFFICIENT: 0.013908,
        BASE_DAMAGE: 364.17,
        SPPT: 2,
        TICK_COUNT: 10,
        DAMAGE_TYPE: 'tech',
        DOT: {
            AP_BASE_COEFFICIENT: 0.066246,
            AP_TIER_COEFFICIENT: 0.00488,
            BASE_DAMAGE: 161.65
        }
    },
    CONCUSSIVE_KICKS: {
        GCD: 0.75,
        COOLDOWN: 8,
        TYPE: 'ASSAULT',
        SUIT_POWER_COST: 15,
        HIT_COUNT: 2,
        AP_BASE_COEFFICIENT: 0.455952,
        AP_TIER_COEFFICIENT: 0.02832,
        BASE_DAMAGE: 967.6,
        T8_ASSAULT_CDR: 2,
        T8_CDR_EFFECTIVENESS: 0.9,
        DAMAGE_TYPE: 'phys'
    },
    COLLAPSE: {
        GCD: 0,
        COOLDOWN: 25,
        TYPE: 'UTILITY',
        SUIT_POWER_COST: 0,
        AP_BASE_COEFFICIENT: 0.263966,
        AP_TIER_COEFFICIENT: 0.059,
        SP_BASE_COEFFICIENT: 0.2237,
        SP_TIER_COEFFICIENT: 0.05,
        BASE_DAMAGE: 973.5,
        DAMAGE_TYPE: 'phys'
    },
    STAGGER: {
        GCD: 0,
        COOLDOWN: 25,
        T4_CDR: 7,
        TYPE: 'UTILITY',
        SUIT_POWER_COST: 0,
        HIT_COUNT: 4,
        AP_BASE_COEFFICIENT: 0.0413,
        AP_TIER_COEFFICIENT: 0.0059,
        SP_BASE_COEFFICIENT: 0.035,
        SP_TIER_COEFFICIENT: 0.005,
        BASE_DAMAGE: 177,
        DAMAGE_TYPE: 'phys'
    },
    PREPARATION: {
        GCD: 0,
        COOLDOWN: 15,
        TYPE: 'UTILITY',
        SUIT_POWER_COST: 0,
        SPPT: 6,
        AVERAGE_TICKS: 2,
        TICKS_PER_SECOND: 2,
        BUFF_DURATION_AVERAGE: 4.5,
        CRIT_CHANCE_AVERAGE: 0.0567,
        BONUS_CRIT_CHANCE_PER_TIER: 0.005
    },
    TACTICAL_RETREAT: {
        GCD: 0,
        COOLDOWN: 30,
        TYPE: 'UTILITY'
    },
    STEALTH: {
        COOLDOWN: 25,
        TYPE: 'NONE'
    }
};

/**
 * AMPs that deal damage. Nano-skin Lethal is assumed and factored into the coefficients.
 * To remove this, divide the coefficient by 1.18.
 */
Simulator.AMPS = {
    UNFAIR_ADVANTAGE: {
        SUIT_POWER_REDUCTION: 8
    },
    STEALTH_MASTERY: {
        CDR: 3
    },
    RIPOSTE: {
        BUFF_DURATION: 5,
        STRIKETHROUGH_PERCENT: 0.06,
        ABILITIES_TO_IGNORE: ['RUIN.DOT', 'FATAL_WOUNDS', 'CUTTHROAT', 'DEVASTATE']
    },
    ONSLAUGHT: {
        AP_BUFF: 0.12
    },
    FATAL_WOUNDS: {
        MAX_STACKS: 5,
        AP_COEFFICIENT: 0.03186,
        ABILITIES_TO_IGNORE: ['RUIN.DOT', 'FATAL_WOUNDS', 'CUTTHROAT', 'DEVASTATE']
    },
    ENABLER: {
        SPPS: 3,
        // Enabler buffed to grant SP all the time. Only refreshes when spending SP and end result is <25 though.
        // Estimated uptime is now 85%.
        EFFECTIVENESS: 0.85
    },
    CUTTHROAT: {
        STACKS_TIL_DAMAGE: 10,
        ICD: 0.33,
        AP_COEFFICIENT: 0.5192,
        ABILITIES_TO_IGNORE: ['ANALYZE_WEAKNESS', 'RUIN.DOT', 'FATAL_WOUNDS', 'CUTTHROAT', 'DEVASTATE']
    },
    DEVASTATE: {
        PERCENT_LIFE_THRESHOLD: 0.25,
        AP_COEFFICIENT: 0.3186,
        ABILITIES_TO_IGNORE: ['ANALYZE_WEAKNESS', 'RUIN.DOT', 'FATAL_WOUNDS', 'CUTTHROAT', 'DEVASTATE']
    },
    KILLER_INSTINCT: {
        ABILITIES_TO_IGNORE: ['ANALYZE_WEAKNESS', 'RUIN.DOT', 'FATAL_WOUNDS', 'CUTTHROAT', 'DEVASTATE']
    }
};

// Base Suit Power regeneration rate, per second.
Simulator.BASE_SPPS = 7;

(function(){
    // Camel cases a constant name, e.g. camelCase('SOME_SKILL_NAME') => 'someSkillName'.
    var camelCase = function(str){
        return str.toLowerCase().replace(/_(\w)/g, function(match, letter){
            return letter.toUpperCase();
        });
    };

    // Finds the ability named, resolving periods.
    var getAbility = function(name){
        var nameParts = name.split('.');
        var ability = Simulator.ABILITIES;
        while (nameParts.length) ability = ability[nameParts.shift()];
        return ability;
    }

    // Creates a function that will determine the damage a Stalker will do for the given ability name.
    var damageForAbility = function(name){
        var nameParts = name.split('.');
        var ability = getAbility(name);
        name = camelCase(nameParts[0]);

        return function(stalker){
            var tier = stalker[name];
            if (tier < 0) return 0;

            var damage = ability.BASE_DAMAGE;
            var ap = stalker.assaultPower;
            var sp = stalker.supportPower;
            var apCoefficient = (ability.AP_BASE_COEFFICIENT || 0) + (ability.AP_TIER_COEFFICIENT || 0) * tier;
            var spCoefficient = (ability.SP_BASE_COEFFICIENT || 0) + (ability.SP_TIER_COEFFICIENT || 0) * tier;
            damage += (ap * apCoefficient) + (sp * spCoefficient);

            return damage;
        };
    };

    // Creates a function that will determine the damage a Stalker will do for the given AMP name.
    var damageForAmp = function(){
        return function(stalker, apCoefficient){
            return stalker.assaultPower * apCoefficient;
        };
    };

    // Functions to determine the damage of each ability we care about.
    var impaleDamage = damageForAbility('IMPALE');
    var shredDamage = damageForAbility('SHRED');
    var analyzeWeaknessDamage = damageForAbility('ANALYZE_WEAKNESS');
    var punishDamage = damageForAbility('PUNISH');
    var ruinDamage = damageForAbility('RUIN');
    var ruinDotDamage = damageForAbility('RUIN.DOT');
    var concussiveKicksDamage = damageForAbility('CONCUSSIVE_KICKS');
    var staggerDamage = damageForAbility('STAGGER');
    var collapseDamage = damageForAbility('COLLAPSE');
    var devastateDamage = damageForAmp('DEVASTATE');
    var cutthroatDamage = damageForAmp('CUTTHROAT');
    var fatalWoundsDamage = damageForAmp('FATAL_WOUNDS');

    // Determines the cooldown of an ability.
    var cooldown = function(stalker, name){
        var cdr = stalker.cooldownReduction;
        if (Simulator.ABILITIES[name].TYPE === 'ASSAULT' && name != 'CONCUSSIVE_KICKS'){
            cdr = stalker.cooldownReduction + stalker.assaultCooldownReduction;
        }
        return Simulator.ABILITIES[name].COOLDOWN * (1 - cdr);
    }

    // Determines the cooldown of the Stalker's Nanoskin.
    // Modified to include CK reducing cooldown of Stealth
    var stealthCooldown = function(stalker){
        var cdr = stalker.stealthMastery ? Simulator.AMPS.STEALTH_MASTERY.CDR : 0;
        return (Simulator.ABILITIES.STEALTH.COOLDOWN - cdr)*(1 - stalker.assaultCooldownReduction);
    }

    // Utility to clone an object.
    var shallowClone = function(obj){
        return Object.keys(obj).reduce(function(result, key){
            result[key] = obj[key];
            return result;
        }, {});
    }

    // Determines the amount of suit power that will be generated over the course of a fight.
    var calculateTotalSuitPower = function(stalker, duration){
        var sp = duration * Simulator.BASE_SPPS;

        if (stalker.shred === 8){
            sp += duration * Simulator.ABILITIES.SHRED.T8_SPPS;
        }
        if (stalker.analyzeWeakness > 3){
            var awCooldown = cooldown(stalker, 'ANALYZE_WEAKNESS');
            if (stalker.analyzeWeakness === 8) awCooldown -= Simulator.ABILITIES.ANALYZE_WEAKNESS.T8_AVERAGE_CDR;

            if (awCooldown <= Simulator.ABILITIES.ANALYZE_WEAKNESS.T4_BUFF_DURATION){
                sp += duration * Simulator.ABILITIES.ANALYZE_WEAKNESS.T4_SPPS;
            } else{
                sp += (duration / awCooldown) * Simulator.ABILITIES.ANALYZE_WEAKNESS.T4_BUFF_DURATION *
                Simulator.ABILITIES.ANALYZE_WEAKNESS.T4_SPPS;
            }
        }
        if (stalker.ruin > 3){
            var deflectChance = bound(0, 1, (stalker.enemyDeflectChance - stalker.strikeThroughChance));
            var ruinApplications = (duration / Simulator.ABILITIES.RUIN.COOLDOWN) * (1 - deflectChance);
            var totalRuinTicks = ruinApplications * Simulator.ABILITIES.RUIN.TICK_COUNT;
            sp += totalRuinTicks * Simulator.ABILITIES.RUIN.SPPT;
        }
        if (stalker.punish > -1){
            var sppu = stalker.punish === 8 ? Simulator.ABILITIES.PUNISH.T8_SPPU : Simulator.ABILITIES.PUNISH.SPPU;
            sp += (duration / cooldown(stalker, 'PUNISH')) * sppu;
        }
        if (stalker.preparation > -1){
            var spPerPrep = (Simulator.ABILITIES.PREPARATION.AVERAGE_TICKS * Simulator.ABILITIES.PREPARATION.SPPT);
            sp += (duration / cooldown(stalker, 'PREPARATION')) * spPerPrep;
        }
        if (stalker.enabler){
            sp += Simulator.AMPS.ENABLER.SPPS * duration * Simulator.AMPS.ENABLER.EFFECTIVENESS;
        }

        return sp + 100;
    };

    // Determines how much damage is done after factoring in mitigation and armor pierce.
    var damageReduction = function(damage, stalker, extraArmorPierce){
        var mitigation = stalker.enemyMitigation;
        var pierce = bound(0, 1, (stalker.armorPierce + extraArmorPierce));

        // Pierce only cuts through armor, which accounts for half of the enemy's mitigation.
        // Therefore we consider half of the damage with pierce and half without.
        var effectiveMitigation = ((1 - pierce) * mitigation) * 0.5;
        effectiveMitigation += mitigation * 0.5;

        return damage * (1 - effectiveMitigation);
    };

    // Determines how much damage each of the Stalker's abilities will do.
    var getAbilityDamage = function(stalker, duration){
        var timeLeft = duration;
        var suitPower = calculateTotalSuitPower(stalker, duration);
        var deflectChance = bound(0, 1, stalker.enemyDeflectChance - stalker.strikeThroughChance);

        var getAbilityStats = function(options){
            options.cdAdjustment = options.cdAdjustment || 0;
            var ability = getAbility(options.abilityName);

            var swings = options.swings || 0;
            if (!swings){
                if (ability.SUIT_POWER_COST && !ability.COOLDOWN){
                    swings = suitPower / (options.spCost || ability.SUIT_POWER_COST);
                } else if (!ability.SUIT_POWER_COST && !ability.COOLDOWN && !options.cooldown){
                    swings = timeLeft / ability.GCD;
                } else {
                    var cd = 0;
                    if (options.cooldown){
                        cd = options.cooldown;
                    } else {
                        cd = cooldown(stalker, options.abilityName) + options.cdAdjustment;
                    }
                    swings = duration / cd;
                }
            }
            swings *= (options.swingAdjustment || 1);
            var timeUsed = swings * (ability.GCD || 0);
            var suitPowerUsed = (options.spCost || ability.SUIT_POWER_COST || 0) * swings;
            swings *= (ability.HIT_COUNT || 1);

            if (options.forceCrits){
                swings -= options.forceCrits;
            }

            var crits = swings * stalker.critHitChance;
            var hits = (swings - crits) * (1 - deflectChance);

            if (options.forceCrits){
                crits += options.forceCrits;
                swings += options.forceCrits;
            }

            hits += crits;

            var rawDamage = options.damageFn(stalker) * ((stalker.critHitSeverity * crits) + (hits - crits));

            return {
                label: options.abilityName,
                swings: swings,
                hits: hits,
                crits: crits,
                nonCrits: hits - crits,
                deflects: swings - hits,
                rawDamage: rawDamage,
                damageType: ability.DAMAGE_TYPE,
                damage: damageReduction(rawDamage, stalker, options.armorPierce || 0),
                suitPowerUsed: suitPowerUsed,
                timeUsed: timeUsed
            };
        }

        var abilities = [];

        if (stalker.punish > -1){
            var punish = getAbilityStats({
                abilityName: 'PUNISH',
                damageFn: punishDamage
            });

            abilities.push(punish);
            abilities.PUNISH = punish;
        }

        if (stalker.concussiveKicks > -1){
            var ckAdjustment = 0;
            var swingsAdjustment = 0;
            if (stalker.concussiveKicks > 3){
                ckAdjustment = Simulator.ABILITIES.CONCUSSIVE_KICKS.GCD;
                swingsAdjustment = 2;
            }

            var ck = getAbilityStats({
                abilityName: 'CONCUSSIVE_KICKS',
                damageFn: concussiveKicksDamage,
                cdAdjustment: ckAdjustment,
                swingAdjustment: swingsAdjustment
            });

            suitPower -= ck.suitPowerUsed;
            timeLeft -= ck.timeUsed;

            abilities.push(ck);
            abilities.CONCUSSIVE_KICKS = ck;
        }

        if (stalker.ruin > -1){
            var ruin = getAbilityStats({
                abilityName: 'RUIN',
                damageFn: ruinDamage
            });

            suitPower -= ruin.suitPowerUsed;
            timeLeft -= ruin.timeUsed;

            var ruinDot = getAbilityStats({
                abilityName: 'RUIN.DOT',
                damageFn: ruinDotDamage,
                swings: ruin.hits,
                swingAdjustment: Simulator.ABILITIES.RUIN.TICK_COUNT,
                cooldown: Simulator.ABILITIES.RUIN.COOLDOWN
            });

            abilities.push(ruin, ruinDot);
            abilities.RUIN = ruin;
            abilities.RUIN_DOT = ruinDot;
        }

        if (stalker.analyzeWeakness > -1){
            var awCdr = stalker.analyzeWeakness === 8 ? -Simulator.ABILITIES.ANALYZE_WEAKNESS.T8_AVERAGE_CDR : 0;

            var aw = getAbilityStats({
                abilityName: 'ANALYZE_WEAKNESS',
                damageFn: analyzeWeaknessDamage,
                cdAdjustment: awCdr
            });

            suitPower -= aw.suitPowerUsed;

            abilities.push(aw);
            abilities.ANALYZE_WEAKNESS = aw;
        }

        if (stalker.collapse > -1){
            var collapse = getAbilityStats({
                abilityName: 'COLLAPSE',
                damageFn: collapseDamage
            });

            abilities.push(collapse);
            abilities.COLLAPSE = collapse;
        }

        if (stalker.stagger > -1){
            var stagger = getAbilityStats({
                abilityName: 'STAGGER',
                damageFn: staggerDamage,
                cdAdjustment: stalker.stagger > 3 ? -Simulator.ABILITIES.STAGGER.T4_CDR : 0
            });

            abilities.push(stagger);
            abilities.STAGGER = stagger;
        }

        if (stalker.impale > -1){
            var stealthCount = duration / stealthCooldown(stalker);
            if(stalker.tacticalRetreat > -1){
                stealthCount += duration / cooldown(stalker, 'TACTICAL_RETREAT');
            }
            var spCost = stalker.impale < 8 ? Simulator.ABILITIES.IMPALE.SUIT_POWER_COST : Simulator.ABILITIES.IMPALE.T8_SUIT_POWER_COST;
            var armorPierce = stalker.impale > 3 ? Simulator.ABILITIES.IMPALE.T4_ARMOR_PIERCE : 0;

            if (stalker.unfairAdvantage){
                suitPower += stealthCount * Simulator.AMPS.UNFAIR_ADVANTAGE.SUIT_POWER_REDUCTION;
            }

            var impale = getAbilityStats({
                abilityName: 'IMPALE',
                damageFn: impaleDamage,
                spCost: spCost,
                armorPierce: armorPierce,
                forceCrits: stealthCount
            });

            suitPower -= impale.suitPowerUsed;
            timeLeft -= impale.timeUsed;

            abilities.push(impale);
            abilities.IMPALE = impale;
        }

        if (stalker.shred > -1){
            armorPierce = stalker.shred >= 4 ? Simulator.ABILITIES.SHRED.T4_ARMOR_PIERCE : 0;

            var shred = getAbilityStats({
                abilityName: 'SHRED',
                damageFn: shredDamage,
                armorPierce: armorPierce
            });

            abilities.push(shred);
            abilities.SHRED = shred;
        }

        if (stalker.fatalWounds){
            var totalCrits = abilities.reduce(function(crits, ability){
                if (Simulator.AMPS.FATAL_WOUNDS.ABILITIES_TO_IGNORE.indexOf(ability.label) === -1){
                    crits += ability.crits;
                }
                return crits;
            }, 0);

            var secondsBetweenCrits = duration / totalCrits;
            var fwTimeLeft = duration;
            var fwHits = 0;
            var currentStacks = 0;

            while (currentStacks < Simulator.AMPS.FATAL_WOUNDS.MAX_STACKS && timeLeft > 0){
                currentStacks++;
                // We'll tick secondsBetweenCrits times before the next stack is added.
                fwHits += Math.floor(secondsBetweenCrits) * currentStacks;
                fwTimeLeft -= secondsBetweenCrits;
            }

            fwHits += fwTimeLeft * currentStacks;
            var fwDamage = fatalWoundsDamage(stalker, Simulator.AMPS.FATAL_WOUNDS.AP_COEFFICIENT) * fwHits;

            var fw = {
                label: 'FATAL_WOUNDS',
                swings: fwHits,
                hits: fwHits,
                crits: 0,
                nonCrits: fwHits,
                deflects: 0,
                rawDamage: fwDamage,
                damageType: Simulator.AMPS.FATAL_WOUNDS.DAMAGE_TYPE,
                damage: damageReduction(fwDamage, stalker, 1),
                suitPowerUsed: 0,
                timeUsed: 0
            };

            abilities.push(fw);
            abilities.FATAL_WOUNDS = fw;
        }

        if (stalker.cutthroat){
            var totalHits = abilities.reduce(function(hits, ability){
                if (Simulator.AMPS.CUTTHROAT.ABILITIES_TO_IGNORE.indexOf(ability.label) === -1){
                    hits += ability.hits
                }
                return hits;
            }, 0);

            totalHits = Math.max(totalHits, duration / Simulator.AMPS.CUTTHROAT.ICD)
            var ctSwings = totalHits / Simulator.AMPS.CUTTHROAT.STACKS_TIL_DAMAGE;
            var ctCrits = ctSwings * stalker.critHitChance;
            var ctHits = ((ctSwings - ctCrits) * (1 - deflectChance)) + ctCrits;
            var ctBaseDamage = cutthroatDamage(stalker, Simulator.AMPS.CUTTHROAT.AP_COEFFICIENT);
            var ctDamage = ctBaseDamage * ((stalker.critHitSeverity * ctCrits) + (ctHits - ctCrits));

            var ct = {
                label: 'CUTTHROAT',
                swings: ctSwings,
                hits: ctHits,
                crits: ctCrits,
                nonCrits: ctHits - ctCrits,
                deflects: ctSwings - ctHits,
                rawDamage: ctDamage,
                damageType: Simulator.AMPS.CUTTHROAT.DAMAGE_TYPE,
                damage: damageReduction(ctDamage, stalker, 0),
                suitPowerUsed: 0,
                timeUsed: 0
            };

            abilities.push(ct);
            abilities.CUTTHROAT = ct;
        }

        if (stalker.devastate){
            var totalCrits = abilities.reduce(function(crits, ability){
                if (Simulator.AMPS.DEVASTATE.ABILITIES_TO_IGNORE.indexOf(ability.label) === -1){
                    crits += ability.crits;
                }
                return crits;
            }, 0);

            var dHits = totalCrits * Simulator.AMPS.DEVASTATE.PERCENT_LIFE_THRESHOLD;
            var dDamage = devastateDamage(stalker, Simulator.AMPS.DEVASTATE.AP_COEFFICIENT) * dHits;

            var devastate = {
                label: 'DEVASTATE',
                swings: dHits,
                hits: dHits,
                crits: 0,
                nonCrits: dHits,
                deflects: 0,
                rawDamage: dDamage,
                damageType: Simulator.AMPS.DEVASTATE.DAMAGE_TYPE,
                damage: damageReduction(dDamage, stalker, 1),
                suitPowerUsed: 0,
                timeUsed: 0
            };

            abilities.push(devastate);
            abilities.DEVASTATE = ct;
        }

        return abilities;
    };

    // Determines how much damage the Stalker will do in a fight.
    var getDamage = function(stalker, duration){
        stalker = shallowClone(stalker);

        if (stalker.onslaught){
            stalker.assaultPower *= (1 + Simulator.AMPS.ONSLAUGHT.AP_BUFF);
        }

        if (stalker.concussiveKicks === 8){
            var abilities = getAbilityDamage(stalker, duration);
            var ck = abilities.CONCUSSIVE_KICKS;
            var CK = Simulator.ABILITIES.CONCUSSIVE_KICKS;
            var ckUseCount = ck.swings / CK.HIT_COUNT;
            stalker.assaultCooldownReduction = ((ckUseCount * CK.T8_ASSAULT_CDR) / duration) *
                CK.T8_CDR_EFFECTIVENESS;
        }

        if (stalker.riposte){
            var deflects = getAbilityDamage(stalker, duration).reduce(function(deflects, ability){
                if (Simulator.AMPS.RIPOSTE.ABILITIES_TO_IGNORE.indexOf(ability.label) === -1){
                    deflects += ability.deflects;
                }
                return deflects;
            }, 0);

            var secondsBetweenDeflects = duration / deflects;
            var riposteBuffCount = (duration / secondsBetweenDeflects) - 1;
            var riposteUptime = bound(0, 1, (riposteBuffCount * Simulator.AMPS.RIPOSTE.BUFF_DURATION) / duration);
            stalker.strikeThroughChance += riposteUptime * Simulator.AMPS.RIPOSTE.STRIKETHROUGH_PERCENT;
        }

        if (stalker.preparation > -1){
            var PREP = Simulator.ABILITIES.PREPARATION;
            var prepCastTime = PREP.AVERAGE_TICKS / PREP.TICKS_PER_SECOND;
            var prepCooldown = cooldown(stalker, 'PREPARATION') + prepCastTime;
            var prepUptime = PREP.BUFF_DURATION_AVERAGE / prepCooldown;
            stalker.critHitChance += (PREP.CRIT_CHANCE_AVERAGE + (PREP.BONUS_CRIT_CHANCE_PER_TIER * stalker.preparation)) * prepUptime;
        }

        if (stalker.killerInstinct){
            var nonCrits = getAbilityDamage(stalker, duration).reduce(function(nonCrits, ability){
                if (Simulator.AMPS.KILLER_INSTINCT.ABILITIES_TO_IGNORE.indexOf(ability.label) === -1){
                    nonCrits += ability.nonCrits;
                }
                return nonCrits;
            }, 0);

            stalker.critHitChance += (1 / (duration / nonCrits)) / 100;
        }

        var abilities = getAbilityDamage(stalker, duration);

        if (stalker.punish > 3){
            abilities.forEach(function(ability){
                if(ability.damageType === 'phys'){
                    ability.rawDamage *= Simulator.ABILITIES.PUNISH.T4_EXPOSE;
                    ability.damage *= Simulator.ABILITIES.PUNISH.T4_EXPOSE;
                }
            });
        }

        var damage = abilities.reduce(function(total, ability){
            return total + ability.damage;
        }, 0);

        return {
            abilities: abilities,
            damage: damage,
            dps: damage / duration
        };
    };

    // Determines the damage done by the Stalker after a given change of stats.
    var getDamageAfterChange = function(stalker, duration, change){
        var oldSeverity = stalker.critHitSeverity;
        if (change.critSeverityRating){
            stalker.critHitSeverity = getSeverity(
                getSeverityRating(oldSeverity) + change.critSeverityRating);
            delete change.critSeverityRating;
        }
        Object.keys(change).forEach(function(stat){
            stalker[stat] += change[stat];
        });
        var damage = Simulator.getDamage(stalker, duration);
        Object.keys(change).forEach(function(stat){
            stalker[stat] -= change[stat];
        });
        stalker.critHitSeverity = oldSeverity;
        return damage;
    };

    // Determines how much critical severity rating is needed for 1% crit severity.
    var severityRatingNeeded = function(stalker){
        var rating = getSeverityRating(stalker.critHitSeverity);
        var A = 0.71428573177128007;
        var B = 1441.2620313260343;
        var C = 2017.7665934446297;

        // f(x) = A - B / (x + C)
        // f(x + a) - f(x) = 0.01
        // a = -(C + x)^2 / (-100B + C + x)

        return (-1 * Math.pow(C + rating, 2)) / ((-100 * B) + C + rating);
    };

    // Determines the critical severity rating from the severity. This is the inverse of getSeverity.
    var getSeverityRating = function(severity){
        var A = 0.71428573177128007;
        var B = 1441.2620313260343;
        var C = 2017.7665934446297;

        // f(x) = A - B / (x + C)
        // x = (-AC + B + Cy) / (A - y)
        severity -= 1.62;
        return ((-1 * A * C) + B + (C * severity)) / (A - severity);
    }

    // Determines the critical severity from a severity rating. This is the inverse of getSeverityRating.
    var getSeverity = function(rating){
        var A = 0.71428573177128007;
        var B = 1441.2620313260343;
        var C = 2017.7665934446297;

        // f(x) = A - B / (x + C)
        var severity = A - (B / (rating + C));
        return severity + 1.62;
    }

    Simulator.getDamage = getDamage;
    Simulator.getDamageAfterChange = getDamageAfterChange;
    Simulator.getSeverityRating = getSeverityRating;
    Simulator.getSeverity = getSeverity;
    Simulator.severityRatingNeeded = severityRatingNeeded;
})();

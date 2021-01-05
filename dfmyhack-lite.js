// inspired by /Bind/Seldon

//https://stackoverflow.com/questions/26496779/best-way-to-summarize-data-for-an-array-of-objects-using-javascript-and-lodash


//distributeSilver to nearby big planets who can take them
// basic mechanics works now; but need to take care of multiple sends
// doc:

/*
op.pauseActions
op.restartActions


op.m0(srcId, tgtId, t = 0, percentageEnergyCap = 20)   // delay by t seconds 
op.mt(srcId, tgtId, sendAt, percentageEnergyCap = 20) // specify move by JavaScript time  or Date.now() + seconds * 1000
op.ms("srcId", "syncID", 0, 20)// synchronize to arrive at the same time

op.d: create a silver depot
op.f: fortify - grab silver and upgrade
op.e: explore.  acquire planets. make them explore also

op.d(fortId, srcId = "", restockTriger = 20, percentageEnergyCap = 50)  // default changed to 50
*/




function dS(srcId, maxRangePct = 50, tgtId="", minSilver = 10000) {

    const source = df.getPlanetWithId(srcId);
    const sourceCoords = source.location.coords;
    const topUp = true;

    if (tgtId === "")  {
    const targetList = df.getMyPlanets()
        .filter((p) => planetIsRevealed(p.locationId))
        .filter((p) => getSilverNeededForUpgrade(p,topUp) > minSilver)
        .filter((p) => (getDistance(sourceCoords, p.location.coords) < df.getMaxMoveDist(srcId, maxRangePct)))
        .filter((p) => p.locationId !== srcId)
        .filter((p) => p.silverGrowth == 0)
        .sort((a, b) => { return getDistance(sourceCoords, a.location.coords) - getDistance(sourceCoords, b.location.coords) })

    if (targetList.length > 0) {
        tgtId = targetList[0].locationId;
        }
    }  else {
        const targetList = [];
    }
    //    .sort((b, a) => df.getDist(srcId, b.locationId) - df.getDist(srcId, a.locationId))
    // Note, first one is always itself; unless using getDist!

    if (tgtId !== "") {
        const FORCES = Math.ceil(df.getEnergyNeededForMove(srcId, tgtId, 1));

        const target = df.getPlanetWithId(tgtId);
        const silverTOSEND = Math.ceil(getSilverNeededForUpgrade(target,topUp), source.silver);

        //      terminal.println(`${getDistance(sourceCoords, target.location.coords)} ${source.range} vs ${source.range*maxRangePct/100}`);

        if (silverTOSEND > 1) {
        terminal.println(`Sending ${silverTOSEND} silver to ${tgtId}`);
        df.move(srcId, tgtId, FORCES, silverTOSEND);
        //        seldonMove(source, target, FORCES, silverTOSEND, recentWeapons);
        }

    } else {
        terminal.println("nothing to do");
        return "nothing to do";
    }
    return "Silver Sent";
}

/* make our own */
// upgrade related helper functions 

function getSilverNeededForUpgrade(planet, topUp = false) {
// amend to return silver amount to top up

    const totalLevel = planet.upgradeState.reduce((a, b) => a + b);
    let needed = (totalLevel + 1) * 0.2 * planet.silverCap;
    const incomingVoyages = df.getAllVoyages()
        .filter((v) => v.toPlanet == planet.locationId)
        .filter((v) => v.player == df.getAccount());
    let incomingSilver = 0;
    if (incomingVoyages.length > 0) {
        incomingSilver
            = incomingVoyages.map((p) => { return p.silverMoved }).reduce((a, b) => a + b)
    }

    if (getPlanetRank(planet) === 0) needed = 0.6 * planet.silverCap;
    if (!topUp) {
        return Math.ceil(Math.max(needed - planet.silver - incomingSilver, 0));
    } else {
        return Math.ceil(Math.max(planet.silverCap - planet.silver - incomingSilver, 0));
    }

}

function getSilverNeeded2(planet) {
    const totalLevel = planet.upgradeState.reduce((a, b) => a + b);
    return Math.ceil(Math.max((totalLevel + 1) * 0.2 * planet.silverCap));
}

function planetCanUpgrade(planet) {
    return (
        planet &&
        !isFullRank(planet) &&
        planet.planetLevel !== 0 &&
        planet.planetResource == 0 &&
        planet.silver >= getSilverNeeded2(planet)
    );
};

function isFullRank(planet) {
    if (!planet) return true;
    const rank = getPlanetRank(planet);
    if (planet.spaceType === 0) return rank >= 3;
    else if (planet.spaceType === 1) return rank >= 4;
    else return rank >= 5;
};


function summarize(r) {   // 
    let sums = {};
    Object.keys(r[0]).forEach(function (k) { // For each key in the data of a single data object
        this[k] = r.map(function (o) { return o[k] }) // Pluck values
            .map(function (w) {
                if (this[w]) { this[w]++; } else { this[w] = 1; } // Count values using an object
                return this;
            }, {}).pop();  // Take just one of the count object copies (poor-man's reduce with this)
    }, sums);
    return sums;
}

/// a few models from Original Seldon code; unverified yet

function moveEnergyDecay(energy, srcPlanet, dist) {
    const scale = (1 / 2) ** (dist / srcPlanet.range);
    let ret = scale * energy - 0.05 * srcPlanet.energyCap;
    if (ret < 0) ret = 0;
    return ret;
}


function modelEnergyGrowth(energy, energyGrowth, energyCap, duration = 10) {
    const denom =
        Math.exp((-4 * energyGrowth * duration) / energyCap) *
        (energyCap / energy - 1) +
        1;
    return energyCap / denom;
}

function modelEnergyDecline(energy, energyGrowth, energyCap, duration = 10) {
    return energy - modelEnergyGrowth(energy, energyGrowth, energyCap, duration);
}

function modelEnergyDeclinePercentage(
    energy,
    energyGrowth,
    energyCap,
    duration = 10
) {
    return (
        ((energy - modelEnergyGrowth(energy, energyGrowth, energyCap, duration)) /
            energy) *
        100
    );
}


function getCoords(planetLocationId) {
    try {
        return df.getPlanetWithId(planetLocationId).location.coords;
    } catch (err) {
        console.error(err);
        console.log(`unable to find ${planetLocationId} in planetLocationMap`);
        return { x: 0, y: 0 };
    }
}

function getDistance(a, b) {
    const dist = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    return dist;
}

function getAngle(a, b) {
    const alpha = 180 * 3.14159265 * Math.atan(((b.y - a.y) / (b.x - a.x)));
    return alpha;
}

function moveShipsDecay(
    shipsMoved,
    fromPlanet,
    dist,
) {
    const scale = (1 / 2) ** (dist / fromPlanet.range);
    let ret = scale * shipsMoved - 0.05 * fromPlanet.energyCap;
    if (ret < 0) ret = 0;

    return ret;
};

function getPlanetRank(planet) {
    if (!planet) return 0;
    return planet.upgradeState.reduce((a, b) => a + b);
};


function upgradeAllWeapons(weapons, tgtId, sendingPercent) {
    // check each of weapons to see if they are at maxRank, upgrade them if not
    // range is brach 1; can be upgraded to 4 times but we assume 3;
    // look under     function initializeUpgrades( under eTH)
    // Range (up to 4 times) = popCap * 1.2; ProGro * 1.2, Range * 1.25

    let curRank;
    let curRange;
    let maxRank;
    let upgradeNum

    for (let p of weapons) {
        curRank = getPlanetRank(p);
        curRange = p.upgradeState[1];

        if (p.spaceType === 0) maxRank = 3;
        else if (p.spaceType === 1) maxRank = 4;
        else maxRank = 5;

        upgradeNum = maxRank - curRank;

        // we only want to upgrade to range 3 by default
        if (upgradeNum + curRange > 3) upgradeNum = Math.min(upgradeNum, 3 - curRange);

        console.log(upgradeNum, p.energy, p.range);

        if (upgradeNum > 0) {
            p.energyCap = 1.2 * upgradeNum * p.energyCap;
            p.energyGrowth = 1.2 * upgradeNum * p.energyCap;
            p.range = 1.25 * upgradeNum * p.range;
            p.rank = p.rank + upgradeNum;
            p.maxDamage = moveShipsDecay(p.energyCap * (sendingPercent / 100), df.getPlanetWithId(p.locationId), getDistance(getCoords(tgtId), getCoords(p.locationId)))

        }
    }
}


function getEnergyCurveAtPercent(planet, pct0, percent) {
    //getEnergyCurveAtPercent(explorer,20,80)
    // returns time (seconds) that planet will reach percent% of energycap
    const p1 = (percent / 100) * planet.energyCap;
    const c = planet.energyCap;
    const p0 = (pct0 / 100) * planet.energyCap;
    const g = planet.energyGrowth;

    const t1 = (c / (4 * g)) * Math.log((p1 * (c - p0)) / (p0 * (c - p1)))

    return t1;
}


function getXYforJUMP(x1, y1, x2, y2, h) {
    let alpha = Math.atan(Math.abs(((y2 - y1) / (x2 - x1))));
    //    console.log (x1,y1,x2,y2,h);
    //    console.log (alpha, Math.cos(alpha)*h, Math.sin(alpha)*h);

    let x;
    let y;

    if (x2 > x1) { x = x1 + Math.cos(alpha) * h }
    else {
        x = x1 - Math.cos(alpha) * h
    }

    if (y2 > y1) { y = y1 + Math.sin(alpha) * h }
    else {
        y = y1 - Math.sin(alpha) * h
    }

    return {
        x: Math.floor(x),
        y: Math.floor(y),
    }
}

function setMinerPosition(x, y) {
    let pattern = df.getMiningPattern();
    let oldcoord = {
        x: pattern.fromChunk.bottomLeft.x,
        y: pattern.fromChunk.bottomLeft.y
    }

    let sidelength = pattern.fromChunk.sideLength;

    console.log(sidelength);

    pattern.fromChunk.bottomLeft.x = Math.floor(x / sidelength) * sidelength;
    pattern.fromChunk.bottomLeft.y = Math.floor(y / sidelength) * sidelength;

    df.setMiningPattern(pattern);

    return oldcoord;
}

function isValidWeapon(
    srcId,
    targetId,
    sendingPercent = 90,
    damageThreshold = 5,
    timeThreshold = 60 * 60
) {



    let tgtCoords = getCoords(targetId);
    let srcCoords = getCoords(srcId);
    let target = df.getPlanetWithId(targetId);
    let planet = df.getPlanetWithId(srcId);

    let arrv = moveShipsDecay(planet.energyCap * (sendingPercent / 100), planet, getDistance(tgtCoords, srcCoords));
    let timeArrival = getDistance(tgtCoords, srcCoords) / (planet.speed) * 100;

    let repeats = Math.max(Math.round(timeThreshold / timeArrival), 1);

    if (arrv * repeats > damageThreshold / 100 * planetPower(target)
        && (timeArrival <= timeThreshold)
    ) { return true } else {
        return false;
    }
}

/* this function is not in planeHelper anymore */
function planetIsRevealed(planetId) {
    return !!df.getLocationOfPlanet(planetId);
}

function planetPower(planet) {
    return (planet.energy * planet.defense) / 100;
}

function planetEnergy(planet) {
    const unconfirmedDepartures = planet.unconfirmedDepartures.reduce(
        (acc, dep) => {
            return acc + dep.forces;
        },
        0
    );
    const FUZZY_ENERGY = Math.floor(planet.energy - unconfirmedDepartures);
    return FUZZY_ENERGY;
}

// Utils time
function secondsToMs(s) {
    return s * 1000;
}
function msToSeconds(ms) {
    return ms / 1000;
}

function within5Minutes(before, now) {
    return (now - before) / 1000 / 60 < 5;
}

// this is in fact made into 10 minutes because xdai network is slow now
function Is5MinutesAgo(before) {
    let ret;
    let now = Date.now() / 1000;
    if ((now - before) > 60 * 10) { return true }
    else { return false }
}

/// start of SELDON

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Seldon = factory());
}(this, (function () {
    'use strict';

    //constants //

    const CLOCKSPEED = 30000;

    const PIRATES = "0x0000000000000000000000000000000000000000";
    const c = {
        AID: "AID",
        JUMP: "JUMP",
        DEPOT: "DEPOT",
        EXPLORE: "EXPLORE",
        FORTIFY: "FORTIFY",
        DELAYED_MOVE: "DELAYED_MOVE",
        PIRATES,
    };


    //snipe

    // Utils/planet //
    // there is a period of blackout where UNCONFIMED is cleared but CONFIRMATION not yet received

    function checkNumInboundVoyages(planetId, from = "") {
        if (from == "") {
            return (
                df.getAllVoyages().filter((v) => v.toPlanet == planetId)
                    .filter((v) => v.arrivalTime > Date.now() / 1000).length +
                df.getUnconfirmedMoves().filter((m) => m.to == planetId).length
            );
        } else {
            return (
                df
                    .getAllVoyages()
                    .filter((v) => v.toPlanet == planetId)
                    .filter((v) => v.arrivalTime > Date.now() / 1000)
                    .filter((v) => v.fromPlanet == from).length +
                df.getUnconfirmedMoves().filter((m) => m.to == planetId && m.from == from)
                    .length
            );
        }
    }


    function pickJUMPtarget(
        srcId,
        destId,
        minLevel = 1,
        tgtIndex = 1,
    ) {
        let percentageRange = 80; //really no use above 50%
        let s2dDIST = df.getDist(srcId, destId);
        let percentageEnergyCap = 5;
        let searchPercent = 30;
        let explorer = df.getPlanetWithId(srcId);

        if (explorer.energyCap <= 401) searchPercent = 20;

        let takeable0 = df
            .getPlanetsInRange(srcId, percentageRange)
            .filter((p) => planetIsRevealed(p.locationId))
            .filter((p) => p.planetLevel >= minLevel)
            .filter((p) => p.owner == PIRATES)
            .filter((p) => s2dDIST > df.getDist(p.locationId, destId))
            .filter((p) => df.getDist(p.locationId, srcId) > df.getMaxMoveDist(srcId, searchPercent))
            .filter((p) => explorer.energyCap >
                df.getEnergyNeededForMove(explorer.locationId, p.locationId, planetPower(p)))

        terminal.println(`${takeable0.length} are in the right direction`);
        if (takeable0.length === 0) return;

        let i, len, a, b;
        let arrv, s2, t1, t2, t3, speed1, speed2;

        // extending the takeble array and sort by projected speed
        for (i = 0, len = takeable0.length; i < len; ++i) {
            a = Math.round(df.getDist(takeable0[i].locationId, destId));
            b = Math.round(df.getDist(takeable0[i].locationId, srcId));

            arrv = df.getEnergyArrivingForMove(srcId, takeable0[i].locationId, explorer.energyCap * (1 - percentageEnergyCap / 100));
            arrv = (arrv > planetPower(takeable0[i])) ? arrv - planetPower(takeable0[i]) : 0.01;
            s2 = df.getMaxMoveDist(takeable0[i].locationId, 50);
            t1 = df.getTimeForMove(srcId, takeable0[i].locationId);
            t2 = getEnergyCurveAtPercent(takeable0[i], arrv / takeable0[i].energyCap, 80);
            t3 = s2 / (takeable0[i].speed / 100);
            speed1 = (s2dDIST - a) / (t1 + t2) * 100;
            speed2 = (s2dDIST - a + s2) / (t1 + t2 + t3) * 100;

            takeable0[i].distCovered = a + b;
            takeable0[i].timeForFlight = t1;
            takeable0[i].time2Charge = t2;
            takeable0[i].arrv = arrv;

            takeable0[i].speedRealized = speed1;
            takeable0[i].speedProjected = speed2;

        }

        takeable0.sort((a, b) => { return b.speedProjected - a.speedProjected });
        // alternative sort if by distCovered short is good.  

        console.log("picking", takeable0.length, " jump tgts speed", (takeable0[tgtIndex - 1].speedProjected));


        // TODO:  a) if already in registry; take next one; b) calculate firing % 
        if (tgtIndex > takeable0.length) return;
        //        if (takeable0[tgtIndex - 1].speedProjected < 50) return;
        return df.getPlanetWithId(takeable0[tgtIndex - 1].locationId);
    }

    function planetCurrentPercentEnergy(planet) {
        const unconfirmedDepartures = planet.unconfirmedDepartures.reduce(
            (acc, dep) => {
                return acc + dep.forces;
            },
            0
        );
        const FUZZY_ENERGY = Math.floor(planet.energy - unconfirmedDepartures);
        return Math.floor((FUZZY_ENERGY / planet.energyCap) * 100);
    }

    function getEnergyArrival(srcId, synId, percentageSend = 25) {
        const { energyCap } = df.getPlanetWithId(srcId);
        const payload = (energyCap * percentageSend) / 100;
        return df.getEnergyArrivingForMove(srcId, synId, payload);
    }
    function findNearBy(
        planetLocationId,
        maxDistance = 5000,
        levelLimit = 3,
        numOfPlanets = 5
    ) {
        const owned = df.getMyPlanets();

        ownedFiltered = owned
            .filter((p) => p.planetLevel <= levelLimit)
            .filter(
                (p) =>
                    getDistance(getCoords(planetLocationId), getCoords(p.locationId)) <
                    maxDistance
            );
        const mapped = ownedFiltered.map((p) => {
            const landingForces = getEnergyArrival(p.locationId, planetLocationId);
            return {
                landingForces,
                planet: p,
            };
        });
    }
    function findWeapons(
        planetLocationId,
        levelLimit = 7,
        numOfPlanets = 5,
        percentageSend = 80,
        maxTime = 30 * 60
    ) {
        const warmWeapons = df
            .getMyPlanets()
            .filter((p) => p.locationId !== planetLocationId)
            .filter((p) => p.planetLevel <= levelLimit)
            .filter((p) => planetCurrentPercentEnergy(p) > 80)
            .filter((p) => df.getTimeForMove(p.locationId, planetLocationId) < maxTime);
        const mapped = warmWeapons.map((p) => {
            const landingForces = getEnergyArrival(
                p.locationId,
                planetLocationId,
                percentageSend
            );
            return {
                landingForces,
                planet: p,
            };
        });

        mapped.sort((a, b) => {
            return b.landingForces - a.landingForces;
        });
        return mapped.map((p) => p.planet).slice(0, numOfPlanets);
    }

    function pickTarget(srcId, takeable) {
        let mapped;
        let maxLevel;
        let maxLevelTakebles;

        mapped = takeable.map((p) => {
            const levels = p.planetLevel;
            return levels;
        }
        );

        maxLevel = Math.max.apply(Math, mapped);
        console.log(`pickTarget: maxLevel = ${maxLevel}`);

        maxLevelTakebles = takeable.filter((p) => p.planetLevel == maxLevel)
        maxLevelTakebles.sort((b, a) => df.getDist(srcId, b.locationId) - df.getDist(srcId, a.locationId))

        return maxLevelTakebles[0];
    }

    //  for (i =0, len=takeable.length; i<len; ++i)  {
    //  console.log (`Level ${takeable[i].planetLevel},\
    //  dist ${df.getDist(srcId,takeable[i].locationId)} \
    //  energy cap  ${takeable[i].energyCap} \
    //  growth ${takeable[i].energyGrowth} \
    //  speed ${takeable[i].speed} \
    //  defense ${takeable[i].defense}
    //  `)
    //  }

    // subroutine explore TODO //
    // 1. use %max energyCap as floor instead
    // 2. delete the action when no more takeble in range
    // 3. handle the case action gets added two times
    // 

    function getFORCEbyPercentCap(explorer, target, percentageEnergyCap) {
        for (let i = 10, len = 0; i > len; --i) {
            if (
                (planetEnergy(explorer) -
                    df.getEnergyNeededForMove(explorer.locationId, target.locationId, (planetPower(target) + target.energyCap * i / 100))) >
                explorer.energyCap * percentageEnergyCap / 100) {
                return Math.floor(
                    df.getEnergyNeededForMove(
                        explorer.locationId, target.locationId,
                        (planetPower(target) + target.energyCap * i / 100)
                    ));
                break;
            }
        }
        return Math.floor(
            df.getEnergyNeededForMove(
                explorer.locationId, target.locationId,
                (planetPower(target) + 200)
            ));
    }

    function isWeaponReady(recentWeapons, explorer) {
        let ret = true;
        let srcId;

        //        debugger;

        // does this fix the locationId bug??
        if (explorer == undefined) { return false }
        else {
            srcId = explorer.locationId;
        }

        if (checkForOOMThreat()) {
            // Prevent OOM bug when executing too many snarks in parallel
            return false;
        }

        if (recentWeapons.length > 0) {

            //            console.log("isWeaponReady is spitting out explorer and recentWeapons...");
            //            console.log(explorer, recentWeapons);

            for (let i = 0, len = recentWeapons.length; i < len; ++i) {
                if (recentWeapons[i].locationId == srcId) {
                    if (Is5MinutesAgo(recentWeapons[i].lastUpdated)
                        || (recentWeapons[i].energy > explorer.energy)) {
                        console.log("removing from recent Weapons");
                        recentWeapons.splice(i, 1);
                    } else {
                        ret = false;
                    }
                }
            }
        }

        return (ret);
    }

    function seldonMove
        (explorer, target, energy, silver = 0,
            recentWeapons, recentTgts) {

        terminal.println(
            `df.move('${explorer.locationId}', '${target.locationId
            }', ${energy}, ${silver})`
        );
        df.move(explorer.locationId, target.locationId, energy, silver);
        recentWeapons.push(explorer);
        if (recentTgts !== undefined)
            recentTgts.push(target.locationId);
    }


    function isPlanetTakable(explorer, target, percentageEnergyCap) {
        let ret = false;

        if (
            (planetEnergy(explorer) * 0.99
                - df.getEnergyNeededForMove(explorer.locationId, target.locationId, planetPower(target))
            )
            > (explorer.energyCap * percentageEnergyCap / 100)
        ) ret = true;

        return (ret);
    }



    function explore(
        recentTgts = [],
        recentWeapons = [],
        srcId,
        percentageRange = 25,
        percentageEnergyCap = 25,
        minLevel = 2
    ) {
        const explorer = df.getPlanetWithId(srcId);

        // allow scheduling an explorer that is still owned by pirate
        if (explorer.owner == PIRATES) { return "NOT Owned" };

        if (!isWeaponReady(recentWeapons, explorer)) { return "TOOSOON" };

        const takeable0 = df
            .getPlanetsInRange(srcId, percentageRange)
            .filter((p) => (p.planetLevel + 1) > minLevel)
            .filter((p) => planetIsRevealed(p.locationId))
            .filter((p) => p.owner == PIRATES)
        // terminal.println(`${takeable0.length} in range `);

        if (takeable0.length == 0) {
            if (minLevel >=3 && explorer.planetLevel >=3){
                return "PERSIST";
            } else {
                return "DONE";
            }

        }

        const takeable1 = takeable0
            .filter((p) => checkNumInboundVoyages(p.locationId) < 1)
        // terminal.println(`${takeable1.length} have no incoming Voyages`);
        const takeable2 = takeable1
            .filter((p) => !recentTgts.includes(p.locationId))
        // terminal.println(`${takeable2.length} are not too recent`);
        const takeable = takeable2
            .filter((p) => (isPlanetTakable(explorer, p, percentageEnergyCap)));
        // terminal.println(`${takeable.length} are takable targets \n`);
        terminal.println(` ${takeable.length}/${takeable0.length} takables,${takeable0.length - takeable1.length} w/incoming,${takeable1.length - takeable2.length} TOOSOON`);
        // todo: change priority to "save up" for bigger planet


        if (takeable.length > 0) {
            terminal.println("[EXPLORE]: Sending...");

            const target = pickTarget(srcId, takeable);
            const FORCES = getFORCEbyPercentCap(explorer, target, percentageEnergyCap);

            // ADD silver here;  if source is silver producing send silver too
            // TODO: fail when planet is just too far to pass takeble filter but when not sending filter
            //send attack
            seldonMove(explorer, target, FORCES, 0, recentWeapons, recentTgts);
            return "SENDING";
        } else if (planetCurrentPercentEnergy(explorer) > 98) {
            terminal.println(
                `[EXPLORER]: ${explorer.locationId} has no valid targets.`, 3
            );
            return "DONE";
        }

        return "WAITING";
    }


    ///create battle plans according to mode 
    /// Never call this manually
    /// supported MODE: BEFORE/AFTER/SYNC, ASAP, INDEX and WhenReady
    function createDelayedMove(
        srcId, syncId, tgtId, sendAt, t,
        percentageEnergyCap = 20,
        index = 0, MODE = "ASAP") {

        let syncVoys;
        let syncVoy;

        // if tgtId is not specified, find it
        // note: getAllVoyages sometimes not updated
        if (tgtId == undefined) {
            syncVoys = df.getAllVoyages()
                .filter((v) => v.fromPlanet == syncId)
                .filter((v) => v.arrivalTime > (Date.now() / 1000));

            if (syncVoys.length != 1) {
                console.log("ERROR creating delayedMove 1");
                return "ERROR creating delayedMove 1";
            } else {
                tgtId = syncVoys[0].toPlanet
                syncVoy = syncVoys[0];

            }
        }

        console.log(tgtId, typeof (tgtId));

        let tgtVoys = df.getAllVoyages()
            .filter((v) => v.toPlanet == tgtId)
            .sort((a, b) => { return (a.timeArrival - b.timeArrival) })

        // work backwards to find sendAt time ; note we dont care if syncId is us or enemy
        // if BEFORE we need 75 seconds buffer; if AFTER we buffer by 15 seconds;
        // INDEX is taken as "arrive after this one"
        // JAM does not fit in here: is about finding enought voyages to jam  up to last arrival;
        // Pester we use AID instead and dont do it here. 

        let tgtCoords = getCoords(tgtId);
        let srcCoords = getCoords(srcId);
        let speed = df.getPlanetWithId(srcId).speed / 100;
        let travelTime = getDistance(tgtCoords, srcCoords) / speed;


        switch (MODE) {
            //          case "JAM":  //borrow from flood; not here
            case "SYNC":  //15 second processing time  
                // for before, set t to negative; 
                sendAt = syncVoy.arrivalTime - travelTime - 15 + t;
                break;
            //            case "AFTER":
            //                sendAt = syncVoy.arrivalTime - travelTime - 15 + t;
            //                break;
            case "INDEX":
                console.log("index = ", index);
                if (index <= tgtVoys.length) {
                    let indexVoy = tgtVoys[index - 1];
                    sendAt = indexVoy.arrivalTime - travelTime - 20 + t;
                } else {
                    console.log("ERROR creating delayedMove 2");
                    return "ERROR creating delayedMove 2";
                }
                break;
            case "ASAP":    // default
            case "WR":
                sendAt = Date.now() / 1000 + t;
            default:

        };

        if (sendAt == null) {
            console.log("Error", tgtId, typeof (tgtId));
            return "ERROR: DELAYED_Move not created.  cannot assess sendAt";

        }

        console.log("DelayedMove created");
        terminal.println("DelayedMove created");

        return {
            type: c.DELAYED_MOVE,
            id: `[DELAYED_${MODE}]-${srcId}-${tgtId}-${sendAt}`,
            MODE: MODE,
            payload: {
                srcId,
                tgtId,
                sendAt,
                percentageEnergyCap,
            }
        }
    }

    /* almost sure dont need this.... */
    function createExplore(
        srcId,
        percentageRange = 25,
        percentageEnergyCap = 25,
        minLevel = 2
    ) {
        return {
            id: `[EXPLORE]-${srcId}-${percentageRange}-${percentageEnergyCap}-${minLevel}`,
            type: c.EXPLORE,
            payload: {
                srcId,
                percentageRange,
                percentageEnergyCap,
                minLevel,
            },
        };
    }

    

    function findSilverSupplier(fortId, silverNeeded, DEPOTRegistry = []) {

        let mines = df.getMyPlanets(fortId)
            .filter((p) => planetIsRevealed(p.locationId))
            .filter((p) => (p.silverGrowth > 0) || DEPOTRegistry.includes(p.locationId))
            .filter((p) => p.silver > 0.5 * silverNeeded)
            .filter((p) => df.getEnergyNeededForMove(p.locationId, fortId, 1) < 0.8 * p.energy)
            .filter((p) => df.getDist(p.locationId, fortId) < 9000) // abt 9000 seconds
            .filter((p) => p.locationId !== fortId)
            .sort((b, a) => { return df.getDist(b.locationId, fortId) - df.getDist(a.locationId, fortId) });

        //console.log (silverNeeded,mines.length);

        if (mines.length == 0) { return };
        // protect the big mines; only use those within 2 lvls of self unless mine is full
        // rethink this: this is not always useful
        //        mines = mines.filter((p) => (p.silver >= 0.95 * p.silverCap) ? true : (p.planetLevel <= df.getPlanetWithId(fortId).planetLevel + 2));

        let fullmines = mines.filter((p) => p.silver > silverNeeded);

        if (fullmines.length > 0) {
            return fullmines[0].locationId;
        } else {
            return mines[0].locationId;
        }
    }


    // Routine Starts
    // put back the recentUpgradeHack for v.05 

    function fortify(
        recentUpgrades = [],
        recentWeapons = [],
        DEPOTRegistry = [],
        fortId,
        srcId = "",
        UpgradePlan = "00111",
        percentageEnergyCap = 35,
    ) {


        // 0. parse UpgradePlan
        let target = df.getPlanetWithId(fortId);
        if (isFullRank(target)) {
            //remove
            recentUpgrades = recentUpgrades.filter((v) => v.id != fortId);
            return "DONE"
        };

        if (target.owner !== df.getAccount()) { return "NOT Owned" };

        let upgradeArray = UpgradePlan.split("");
        const currentRank = getPlanetRank(target);
        let branch = Number(upgradeArray[currentRank]);


        // if by error this branch already has3 upgrades
        if (target.upgradeState[branch] == 3) {
            if (branch == 1) branch = 0;
            else branch = 1;
        }

        // 1. upgrade if can be upgraded
        //TODO: timer can be smarter.  if there is a recent upgrade, set timer to lag longer
        let recentUpgrade;

        // start old code block
        if (recentUpgrades.filter((v) => v.id == fortId).length == 0) {
            console.log("initializing recentUpgrades");
            recentUpgrade = { id: fortId, rank: currentRank, isReady: true, timer: 0 }
            recentUpgrades.push(recentUpgrade);
        } else {
            recentUpgrade = recentUpgrades.filter((v) => v.id == fortId)[0];
        }

        if (recentUpgrade.isReady == false) {  //too recent...
            if ((recentUpgrade.rank < currentRank)) {
                recentUpgrade.isReady == true;
                recentUpgrade.rank = currentRank;
                recentUpgrades = recentUpgrades.filter((v) => v.id != fortId);
                recentUpgrades.push(recentUpgrade);
            } else {
                return "upgradePENDING";
                // didnt need to return; could run logistics but too complicated 
            }
        }

        // end old code block

        //==> continue to fix here 
        // isReady it now guaranteed to be true   
        // if upgradeTimer is set then we do the update and reset the timer

        if ((recentUpgrade.timer > 0) && !checkForOOMThreat()) {
            //        if (planetCanUpgrade(target) && !checkForOOMThreat()) {
            terminal.println(`Upgrading to Rank ${currentRank + 1} \n`, 'Green');
            recentUpgrade.timer = 0;  //reset the timer
            recentUpgrades = recentUpgrades.filter((v) => v.id != fortId);
            recentUpgrades.push(recentUpgrade);      //--<<<<
            df.upgrade(target.locationId, branch);
            //    recentUpgrades...
            return "UPGRADING";
        }

        // if it is ready to upgrade, instead of upgraidng now, put in a timer to do upgrade next cycle;
        if (planetCanUpgrade(target)) {
            recentUpgrade.timer = 30;

            //console.log (recentUpgrade);
            recentUpgrades = recentUpgrades.filter((v) => v.id != fortId);
            recentUpgrades.push(recentUpgrade);      //--<<<<
            return "UPGRADING next cycle";
            //            return "upgrading now";
        }

        // end of upgrade section

        let silverTOSEND = getSilverNeededForUpgrade(target);

        // look for a supplier  
        if (srcId === "") {
            srcId = findSilverSupplier(fortId, silverTOSEND, DEPOTRegistry);
            if (srcId === undefined) return "WAITING 1";
        }

        // 2. ship silver needed for next upgrade; 
        let supplier = df.getPlanetWithId(srcId);

        if (supplier.owner === PIRATES) { return "Silver Mine not owned" };
        if (!isWeaponReady(recentWeapons, supplier)) { return "TOOSOON" };

        if (silverTOSEND > supplier.silver && supplier.silver == supplier.silverCap)
            silverTOSEND = supplier.silverCap;

        if (silverTOSEND <= supplier.silver * 0.95 // dont send full silver; 
            && silverTOSEND !== 0
            && (
                (planetEnergy(supplier)
                    - df.getEnergyNeededForMove(srcId, fortId, 5))
                > (supplier.energyCap * percentageEnergyCap / 100)
            )) {
            let FORCES = Math.ceil(df.getEnergyNeededForMove(srcId, fortId, 1));
            terminal.println("[FORTIFY]: Sending...");
            seldonMove(supplier, target, FORCES, silverTOSEND, recentWeapons);
            return "Sending Silver";
        } else {
            //            console.log (silverTOSEND, supplier);
            return "WAITING 2";
        }

        // 4. call it DONE if srcId has no more silver and it does produce silver
        // (note, upgrade and move action can happen in one go; they are inpendent)

    } // Routine FORTIFY ENDS        

    // when is AID done?  never? 
    // TODO: need a clearAID function

    function aid(
        recentWeapons,
        fortId,
        srcId,
        percentageTriger = 80,
        percentageEnergyCap = 20) {

        let target = df.getPlanetWithId(fortId);
        let supplier = df.getPlanetWithId(srcId);

        // if (target.owner === PIRATES) {return "NOT Owned"};
        if (supplier.owner === PIRATES) { return "NOT Owned" };

        // 1. if target energy is below trigger
        // TODO: this accounts for departure from target but not arrivals
        if (planetEnergy(target) > percentageTriger * target.energyCap / 100) {

            return "No Need";
        }

        if (checkNumInboundVoyages(fortId) >= 6) {
            //Too many inbound
            terminal.println("[DELAYED]: Too many inbounds", 4);
            return;  // will wait
        }

        // check if we ourselves are > trigger
        if (planetEnergy(supplier) < (100 - percentageEnergyCap) / 100 * supplier.energyCap) {
            return "Still Recoving";
        }
        // ready to send; TODO: should be checking jam rate 
        if (!isWeaponReady(recentWeapons, supplier)) { return "TOOSOON" };

        let FORCES = Math.ceil(supplier.energy - supplier.energyCap * percentageEnergyCap / 100);

        terminal.println("[AID]: Sending aid now ...");
        seldonMove(supplier, target, FORCES, 0, recentWeapons);
        return "Sending aid";

    }

    // END function AID

    // TODO: Depot function can also call for energy reinforcement 
    function silverDepot(
        recentWeapons,
        fortId,
        srcId = "",
        restockTriger = 20,
        percentageEnergyCap = 50) {

        let target = df.getPlanetWithId(fortId);
        if (target.owner === PIRATES) { return "NOT Owned" };

        //TODO: return error if fortId is a silver producer

        // 1. if silver is above restock level, no need 
        // TODO: this accounts for departure from target but not arrivals
        const incomingVoyages = df.getAllVoyages()
            .filter((v) => v.toPlanet == target.locationId)
            .filter((v) => v.player == df.getAccount());

        let incomingSilver = 0;
        if (incomingVoyages.length > 0) {
            incomingSilver
                = incomingVoyages.map((p) => { return p.silverMoved }).reduce((a, b) => a + b)
        }

        let silverToStock = target.silverCap - target.silver - incomingSilver;

        if (silverToStock < target.silverCap * (100 - restockTriger) / 100) {
            return "No Need";
        }

        // look for a supplier  
        if (srcId === "") {
            srcId = findSilverSupplier(fortId, silverToStock);
            if (srcId === undefined) return "WAITING";
        }

        let supplier = df.getPlanetWithId(srcId);

        if (!isWeaponReady(recentWeapons, supplier)) { return "TOOSOON" };
        if (silverToStock > supplier.silver && supplier.silver == supplier.silverCap)
            silverToStock = supplier.silverCap;

        if (silverToStock <= supplier.silver
            && silverToStock !== 0
            && (
                (planetEnergy(supplier)
                    - df.getEnergyNeededForMove(srcId, fortId, 5))
                > (supplier.energyCap * percentageEnergyCap / 100)
            )) {
            let FORCES = Math.ceil(df.getEnergyNeededForMove(srcId, fortId, 1));
            terminal.println(`[DEPOT]: fetching ${silverToStock} silver `);
            seldonMove(supplier, target, FORCES, silverToStock, recentWeapons);
            return "Fetching Silver";
        } else {
            return "WAITING";
        }
    }

    // END function silverDepot


    // subroutine delayedMove
    function delayedMove(recentWeapons, action) {
        const { srcId, tgtId, sendAt, percentageEnergyCap } = action.payload;
        const MODE = action.MODE;

        const match = df.getMyPlanets().filter((t) => t.locationId == srcId);

        //        console.log(MODE, sendAt, Date.now() / 1000, srcId, tgtId);


        if (match.length == 0 && MODE !== "WR") {
            //Should delete self on this case
            terminal.println("[DELAYED]: Lost source; deleting action", 4);
            return true; //should we return true here to delete itself?
        }
        const source = match[0];
        const target = df.getPlanetWithId(tgtId);


        if (MODE == "WR" && target.owner == df.account) {
            terminal.println("[DELAYED WR]: target acquired", 4);
            return "DONE";  //only DONE when target is acquired
        }

        if (checkNumInboundVoyages(tgtId) >= 6) {
            //Too many inbound
            terminal.println("[DELAYED]: Too many inbounds", 4);
            return;  // will wait
        }

        if (!isWeaponReady(recentWeapons, source)) {
            terminal.println("[DELAYED]: TOOSOON", 4);
            return;
        };

        //// if ASAP mode, check trigger level oe return; Note Pester is no longer here ///
        if (MODE == "ASAP" || MODE == "WR") {
            if (planetEnergy(source) < (100 - percentageEnergyCap) / 100 * source.energyCap) {
                terminal.println("[DELAYED ASAP/WR]: not enough health", 4);
                return;
            }
        }


        // use our method ///
        let FORCES = Math.ceil(source.energy - source.energyCap * percentageEnergyCap / 100);
        let SILVER = 0;

        if (MODE == "WR") {
            FORCES = Math.ceil(source.energy - 10 * percentageEnergyCap / 100);
            // see if we should send silver
            if (target.silver < 0.6 * target.silverCap) {
                SILVER = 0.6 * target.silverCap - target.silver;
                SILVER = (SILVER < source.silver) ? SILVER : source.silver;
            }
        }  // always send 90%


        if (sendAt < Date.now() / 1000) {
            console.log(
                `[DELAYED]:  ${srcId.substring(8)} ATTACK LAUNCH ${Date(sendAt * 1000)}`
            );
            terminal.println("[DELAYED]: LAUNCHING ATTACK", 4);

            //send attack
            terminal.println(`df.move('${srcId}', '${tgtId}', ${FORCES}, 0)`);
            seldonMove(source, target, FORCES, SILVER, recentWeapons);
            return true;
        } else {
            terminal.println(`[DELAYED]: ATTACK SCHEDULED in ${Math.round(sendAt - Date.now() / 1000)} seconds`);
        }
        return;
    }

    //Util version
    function parseVersionString(string) {
        const [major, minor, patch] = string.split(".");
        return { major, minor, patch };
    }

    function areVersionsCompatible(newVersion, oldVersion) {
        if (!oldVersion) {
            return false;
        }
        const newV = parseVersionString(newVersion);
        const oldV = parseVersionString(oldVersion);
        if (newV.major !== oldV.major) {
            //Raise Error
            return false;
        } else if (newV.minor !== oldV.minor) {
            //Should have a migration available
            return false;
        } else if (newV.patch !== oldV.patch) {
            //Should not effect actions schema
            return true;
        } else {
            return true;
        }
    }

    function MybonusFromHex(hex) {
        const bonuses = Array(5).fill(false);

        for (let i = 0; i < bonuses.length; i++) {
            bonuses[i] = MygetBytesFromHex(hex, 9 + i, 10 + i) < (16);
        }

        return bonuses;
    };


    function MyplanetHasBonus(planet) {
        if (!planet) return false;
        return MybonusFromHex(planet.locationId).reduce((a, b) => a || b);
    };

    MygetBytesFromHex("000020aa03fe0aafe1f4ae6f02cdd022975da1efb9a56a6427af340719fc868d", 9, 10)

    function MygetBytesFromHex(hexStr, startByte, endByte) {
        const byteString = hexStr.substring(2 * startByte, 2 * endByte);
        //  return bigInt(`0x${byteString}`);
        return Number(`0x${byteString}`);

    };


    //core try touching as litle as possible
    class Manager {
        actions = [];
        recentTgts = [];
        recentWeapons = [];
        recentUpgrades = [];
        DEPOTRegistry = [];
        spaceJumpers = [];
        minerCoords = {};
        intervalId = "";
        version = "0.0.1";
        dead = false;

        constructor(blob = []) {
            if (typeof window.__SELDON_CORELOOP__ == "undefined") {
                //setup append only interval id storage
                window.__SELDON_CORELOOP__ = [];
            } else {
                //clear out old intervald
                console.log("KILLING PREVIOUS INTERVALS");
                window.__SELDON_CORELOOP__.forEach((id) => clearInterval(id));
            }
            if (blob.length > 0) {
                this.actions = blob;
                this.storeActions();
            }
            this.rehydrate();
            this.loadJumpers();
            //==< load the spaceJumpers here ;
            this.intervalId = setInterval(this.coreLoop.bind(this), CLOCKSPEED);  //speed up from 30
            window.__SELDON_CORELOOP__.push(this.intervalId);
            //aliases
            //      this.s = this.swarm.bind(this);
            this.d = this.createDepot.bind(this);
            this.s = this.createDepot.bind(this);

            this.e = this.createExplore.bind(this);
            this.f = this.createFortify.bind(this);
            this.af2 = this.af2.bind(this);
            this.af3 = this.af3.bind(this);
            this.af4 = this.af4.bind(this);
            this.af5 = this.af5.bind(this);

            this.a = this.createAID.bind(this);
//            this.j = this.createJUMP.bind(this);
            this.w = this.setMinerPositionbyId.bind(this);
            this.ms = this.createMoveSync.bind(this);   //b4
            this.mt = this.createMoveByTime.bind(this);  //after
            this.mi = this.createMoveByIndex.bind(this);  //index #
            //            this.mj = this.createJam.bind(this); //jam
            this.m0 = this.createMoveASAP.bind(this);
            this.mWR = this.createMoveWR.bind(this);
            this.mp = this.createMovePester.bind(this);   //repeat move
            //            this.t = this.createTake.bind(this); //takedown of a single target

        }

        storeActions() {
            window.localStorage.setItem(
                "actions",
                JSON.stringify({ version: this.version, actions: this.actions })
            );
        }

        pauseActions() {
            window.localStorage.setItem(
                "savedActions",
                JSON.stringify({ version: this.version, actions: this.actions })
            );
            this._wipeActions();

        }

        restartActions() {
            try {
                if (typeof object == "undefined") {
                    const raw = window.localStorage.getItem("savedActions");
                    if (raw === null) {
                        console.error("No saved Actions to Rehydrate");
                        return;
                    }
                    const payload = JSON.parse(raw);
                    if (areVersionsCompatible(this.version, payload?.version)) {
                        this.actions = payload.actions;
                        let savedActions = [];
                        window.localStorage.setItem(
                            "savedActions",
                            JSON.stringify(savedActions)
                        );
                    }
                }
            } catch (err) {
                console.error("Issue restarting saved Actions");
                throw err;
            }
        }


        createAction(action) {
            this.actions.push(action);
            this.storeActions();
        }


        coreLoop() {
            let ret;

            terminal.println("[CORE]: Running Subroutines", 2);
            this.actions.forEach((action) => {

                // here is opportunity to operate on recentTgts

                //       console.log(`${action.payload.srcId} \n}`);
                if (checkForOOMThreat()) {
                    // Prevent OOM bug when executing too many snarks in parallel
                    terminal.println("[CORE]: exit on OOM", 2);
                    return;
                }
                try {
                    switch (action.type) {
                        case c.AID:
                            ret = aid(
                                this.recentWeapons,
                                action.payload.fortId,
                                action.payload.srcId,
                                action.payload.percentageTriger,
                                action.payload.percentageEnergyCap
                            );
                            terminal.println(`AID finished with ${ret}`);
                            switch (ret) {
                                case "DONE": this.delete(action.id);
                                    break;
                                default:
                            };
                            break;
                        case c.EXPLORE:
                            ret = (explore(
                                this.recentTgts,
                                this.recentWeapons,
                                action.payload.srcId,
                                action.payload.percentageRange,
                                action.payload.percentageEnergyCap,
                                action.payload.minLevel
                            ));
                            switch (ret) {
                                case "DONE": this.delete(action.id)
                                    break;
                                    case "SENDING":
                                    // setup another EXPLORE
                                    if (action.payload.minLevel == 1) {
                                        this.createExplore(this.recentTgts[this.recentTgts.length - 1], 95, 5, 2)
                                    }
                                    else {
                                        this.createExplore(this.recentTgts[this.recentTgts.length - 1],
                                            Math.min(action.payload.percentageRange, 25),
                                            Math.max(action.payload.percentageEnergyCap, 25),
                                            Math.max(action.payload.minLevel, 2)
                                        )

                                    }
                                    terminal.println(`EXPLORE SENDING +  setting up new `);
                                    break;
                                case "PERSIST":
                                case "NOT Owned":
                                case "TOOSOON":
                                case "WAITING":
                                default:
                                    terminal.println(`EXPLORE finished with ${ret}`);
                                    break;
                            };
                            break;
                        case c.DEPOT:
                            //TODO: this does not seem to work on Seldon restart?
                            if (!this.DEPOTRegistry.includes(action.payload.fortId)) {
                                console.log("Adding to DEPOT registray:", action.payload.fortId);
                                this.DEPOTRegistry.push(action.payload.fortId);
                            }
                            ret = (silverDepot(
                                this.recentWeapons,
                                action.payload.fortId,
                                action.payload.srcId,
                                action.payload.restockTrigger,
                                action.payload.percentageEnergyCap
                            ));
                            terminal.println(`DEPOT finished with ${ret}`);
                            switch (ret) {
                                case "DONE": this.delete(action.id)
                                    break;
                                default:
                            };
                            break;
                        case c.JUMP:
                            ret = (jump(
                                this.recentTgts,
                                this.recentWeapons,
                                this.spaceJumpers,
                                this.minerCoords,
                                action.payload.srcId,
                                action.payload.destId
                            ));
                            terminal.println(`JUMP finished with ${ret}`);
                            switch (ret) {
                                case "DONE": this.delete(action.id)
                                    break;
                                default:
                            };
                            break;
                        case c.FORTIFY:
                            ret = fortify(
                                this.recentUpgrades,
                                this.recentWeapons,
                                this.DEPOTRegistry,
                                action.payload.fortId,
                                action.payload.srcId,
                                action.payload.UpgradePlan,
                                action.payload.percentageEnergyCap
                            );
                            terminal.println(`FORTIFY finished with ${ret}`);
                            switch (ret) {
                                case "DONE": this.delete(action.id);
                                    break;
                                default:
                            };
                            break;
                        case c.DELAYED_MOVE:
                            ret = delayedMove(this.recentWeapons, action);
                            // tricking code into not deleting WR "not done cases"
                            if (action.MODE == "WR") {
                                if (ret == "DONE") {
                                    ret = true;
                                } else { ret = false; }
                            }

                            if (ret == true) {
                                this.delete(action.id);  //send once unless WR not done
                            } else {
                                console.log("DELAYED return", ret);
                            }
                            break;
                        default:
                            break;
                    }
                } catch (error) {
                    console.error(action);
                    console.error(error);
                }
            });
        }

        setMinerPositionbyId(srcId) {
            let srcCoords = getCoords(srcId);
            let x = srcCoords.x;
            let y = srcCoords.y;
            let pattern = df.getMiningPattern();
            let oldcoord = {
                x: pattern.fromChunk.bottomLeft.x,
                y: pattern.fromChunk.bottomLeft.y
            }

            pattern.fromChunk.bottomLeft.x = x;
            pattern.fromChunk.bottomLeft.y = y;

            df.setMiningPattern(pattern);

            return oldcoord;
        }

        unswarm(planetId) {
            this.actions = this.actions.filter((a) => {
                return a.payload.opponentsPlanetLocationsId !== planetId;
            });
        }

        createExplore(
            ownPlanetId,
            percentageRange = 25,
            percentageEnergyCap = 25,
            minLevel = 2
        ) {
            if (this.dead) {
                console.log("[CORELOOP IS DEAD], createExplore ignored");
                return;
            }
            this.createAction(
                createExplore(ownPlanetId, percentageRange, percentageEnergyCap, minLevel)
            );
        }

        createFortify(
            fortId,
            UpgradePlan = "00111",
            srcId = "",
            percentageEnergyCap = 35
        ) {
            if (this.dead) {
                console.log("[CORELOOP IS DEAD], createFortity ignored");
                return;
            }
            this.createAction({
                id: `[FORTIFY]-${fortId}-${srcId}-${UpgradePlan}-${percentageEnergyCap}`,
                type: c.FORTIFY,
                payload: {
                    fortId,
                    srcId,
                    UpgradePlan,
                    percentageEnergyCap,
                },
            })
        }

        af2(planetId, bonusOnly = false, maxNum = 10, radius = 4000,) {
            this.autoFortify(planetId, radius, maxNum, 2, bonusOnly)
        }

        af3(planetId, bonusOnly = false, maxNum = 10, radius = 4000,) {
            this.autoFortify(planetId, radius, maxNum, 3, bonusOnly)
        }
        af4(planetId, bonusOnly = false, maxNum = 10, radius = 4000,) {
            this.autoFortify(planetId, radius, maxNum, 4, bonusOnly)
        }
        af5(planetId, bonusOnly = false, maxNum = 10, radius = 4000,) {
            this.autoFortify(planetId, radius, maxNum, 5, bonusOnly)
        }

        autoFortify(planetId, radius = 4000, maxNum = 12, pLevel = 3, bonusOnly = false) {
            // auto fortify planets within radius; limit to 10; we do it for the exact level
            // 1.look for eligible planets within range; if planetId not specified, look in the whole map
            let myPs = [];
            let tmpArray = [];
            let curFortifys = [];

            curFortifys = this.actions.map((p) => {
                return (p.type == c.FORTIFY) ? p.payload.fortId : "";
            });

            let counter = curFortifys.length;

            tmpArray = df.getMyPlanets()
                .filter((p) => p.planetLevel === pLevel)
                .filter((p) => planetIsRevealed(p.locationId))
                .filter((p) => p.silverGrowth == 0)
                .filter((p) => !isFullRank(p))
                .filter((p) => !curFortifys.includes(p.locationId))

            console.log(tmpArray.length, radius);


            if (planetId !== undefined) {
                //    let target = df.getPlanetWithId(planetId);
                let tgtCoords = getCoords(planetId);
                myPs = tmpArray
                    .filter((p) => (getDistance(tgtCoords, getCoords(p.locationId)) < radius))
                    .sort((b, a) => { return getPlanetRank(a) - getPlanetRank(b) });
            } else {
                myPs = tmpArray
                    .sort((b, a) => { return (getPlanetRank(a) - getPlanetRank(b)) });
            }


            let myPswithBonus = myPs.filter((p) => MyplanetHasBonus(p));

            console.log(myPs.length, myPswithBonus.length);

            if (myPswithBonus.length > 0) {
                counter += myPswithBonus.length;
                for (let p of myPswithBonus) {
                    console.log("creating FORTIFY", p.locationId, "00111");
                    this.createFortify(p.locationId, "00111");
                }
            }


            let myPNormals = [];

            myPNormals = myPs.filter((p) => !MyplanetHasBonus(p));
            //                  .sort ((a,b) => {return getDistance(tgtCoords, getCoords(a.locationId))- getDistance(tgtCoords, getCoords(b.locationId))});
            if (counter >= maxNum || myPNormals.length == 0 || bonusOnly) {
                console.log("max numbers of Fortify reached OR nothing to do");
                return;
            }

            for (let i = 0; i < maxNum - counter; ++i) {
                console.log("creating FORTIFY", myPNormals[i].locationId, "00111");
                this.createFortify(myPNormals[i].locationId, "00111");
            }

        }


        createAID(
            srcId,
            fortId,
            percentageTriger = 80,
            percentageEnergyCap = 20
        ) {
            if (this.dead) {
                console.log("[CORELOOP IS DEAD], createFortify ignored");
                return;
            }
            this.createAction({
                id: `[AID]-${srcId}-${fortId}-${percentageTriger}-${percentageEnergyCap}`,
                type: c.AID,
                payload: {
                    fortId,
                    srcId,
                    percentageTriger,
                    percentageEnergyCap,
                },
            })
        }

        createDepot(
            fortId,
            srcId = "",
            restockTriger = 20,
            percentageEnergyCap = 50
        ) {
            if (this.dead) {
                console.log("[CORELOOP IS DEAD], createDepot ignored");
                return;
            }
            this.createAction({
                id: `[DEPOT]-${fortId}-${srcId}-${restockTriger}-${percentageEnergyCap}`,
                type: c.DEPOT,
                payload: {
                    fortId,
                    srcId,
                    restockTriger,
                    percentageEnergyCap,
                },
            })
        }

       
        createMoveSync(srcId, syncId, t = 0, percentageEnergyCap = 20, tgtId) {
            let sendAt = null;
            let index = 0;
            let MODE = "SYNC";

            if (this.dead) {
                console.log("[CORELOOP IS DEAD], delayed move not created");
                return;
            }
            this.createAction(               //send to arrive before synId does
                createDelayedMove(
                    srcId, syncId, tgtId,
                    sendAt, t,
                    percentageEnergyCap,
                    index,
                    MODE)  //returns the action string
            );
        }

        /*        //retiring MoveAfter
                createMoveAfter(srcId, syncId, t = 0, percentageEnergyCap = 20, tgtId) {
                    let sendAt = null;
                    let index = 0;
                    let MODE = "AFTER";
        
                    if (this.dead) {
                        console.log("[CORELOOP IS DEAD], delayed move not created");
                        return;
                    }
                    this.createAction(               //send to arrive before synId does
                        createDelayedMove(
                            srcId, syncId, tgtId,
                            sendAt, t,
                            percentageEnergyCap = 20,
                            index,
                            MODE)  //returns the action string
                    );
                }
        */
        createMoveByIndex(srcId, tgtId, index, t = 0, percentageEnergyCap = 20) {
            let syncId;
            let sendAt = null;
            let MODE = "INDEX";


            if (this.dead) {
                console.log("[CORELOOP IS DEAD], delayed move not created");
                return;
            }
            this.createAction(               //send to arrive before synId does
                createDelayedMove(
                    srcId, syncId, tgtId,
                    sendAt, t,
                    percentageEnergyCap,
                    index,
                    MODE)  //returns the action string
            );
        }

        createMovePester(
            srcId,
            fortId,
            percentageTriger = 95,
            percentageEnergyCap = 20
        ) {
            if (this.dead) {
                console.log("[CORELOOP IS DEAD], createMovePester ignored");
                return;
            }
            this.createAction({
                id: `[AID]-${srcId}-${fortId}-${percentageTriger}-${percentageEnergyCap}`,
                type: c.AID,
                payload: {
                    fortId,
                    srcId,
                    percentageTriger,
                    percentageEnergyCap,
                },
            })
        }

        createMoveWR(srcId, tgtId, percentageEnergyCap = 50) {
            let sendAt = null;
            let syncId = null;
            let t = 0;
            let MODE = "WR";
            let index = 0;

            if (this.dead) {
                console.log("[CORELOOP IS DEAD], delayed move not created");
                return;
            }
            this.createAction(               //send to arrive before synId does
                createDelayedMove(
                    srcId, syncId, tgtId,
                    sendAt, t,
                    percentageEnergyCap,
                    index,
                    MODE)  //returns the action string
            );
        }


        createMoveByTime(srcId, tgtId, sendAt, percentageEnergyCap = 20) {
            let syncId = null;
            let t = 0;
            let MODE = "ASAP";
            let index = 0;

            if (this.dead) {
                console.log("[CORELOOP IS DEAD], delayed move not created");
                return;
            }
            this.createAction(               //send to arrive before synId does
                createDelayedMove(
                    srcId, syncId, tgtId,
                    sendAt, t,
                    percentageEnergyCap,
                    index,
                    MODE)  //returns the action string
            );
        }

        createMoveASAP(srcId, tgtId, t = 0, percentageEnergyCap = 20) {
            let sendAt = null;
            let syncId = null;
            let MODE = "ASAP";
            let index = 0;

            if (this.dead) {
                console.log("[CORELOOP IS DEAD], delayed move not created");
                return;
            }
            this.createAction(               //send to arrive before synId does
                createDelayedMove(
                    srcId, syncId, tgtId,
                    sendAt, t,
                    percentageEnergyCap,
                    index,
                    MODE)  //returns the action string
            );
        }

        //        createJam(srcId, syncId, percentageEnergyCap = 20, tgtId) {MODE="JAM"}



        delete(id) {
            this.actions = this.actions.filter((a) => a.id !== id);
            this.storeActions();
        }

        _wipeActions() {
            this.actions = [];
            this.DEPOTRegistry = [];
            this.recentTgts = [];
            this.recentUpgrades = [];
            this.recentWeapons = [];
            this.spaceJumpers = [];
            this.storeActions();
        }

        _deleteActions(t = "") {
            let actionType;
            let index;

            if (t == "") {
                this.actions = this.actions.filter((a) => !a.id.includes(c.AID));
                this.actions = this.actions.filter((a) => !a.id.includes(c.EXPLORE));
                this.actions = this.actions.filter((a) => !a.id.includes(c.DEPOT));
                this.DEPOTRegistry = [];
            } else {
                switch (t) {
                    case "a": actionType = c.AID
                        break;
                    case "m": actionType = c.DELAYED_MOVE
                        break;
                    case "d": actionType = c.DEPOT
                        this.DEPOTRegistry = [];
                        break;
                    case "e": actionType = c.EXPLORE
                        break;
                    case "f": actionType = c.FORTIFY
                        break;
                    case "j": actionType = c.JUMP
                        break;
                    default:
                        index = parseInt(t);
                };
                if (index == undefined) {
                    this.actions = this.actions.filter((a) => !a.id.includes(actionType));
                } else {
                    this.actions.splice(index, 1);  //splice seems wrong when index = 0
                }
            }
            this.storeActions();
        }

        kill() {
            console.log(`KILLING CORE LOOP ${this.intervalId}`);
            this.dead = true;
            clearInterval(this.intervalId);
        }
        killAll() {
            window.__SELDON_CORELOOP__.forEach((intervalId) =>
                clearInterval(intervalId)
            );
        }
        pause() {
            this.dead = true;
            clearInterval(this.intervalId);
        }
        restart() {
            this.intervalId = setInterval(this.coreLoop.bind(this), CLOCKSPEED);  //speed up
            window.__SELDON_CORELOOP__.push(this.intervalId);
            this.dead = false;
        }
        printActions() {
            console.log(JSON.stringify(this.actions));
        }
        listActions() {
            console.log(this.actions);
        }
        _not_working_centerPlanet(locationId) {
            let p = df.getPlanetWithId(locationId);
            uiManager.setSelectedPlanet(p);
            uiManager.emit("centerLocation", p);
        }
        rehydrate() {
            try {
                if (typeof object == "undefined") {
                    const raw = window.localStorage.getItem("actions");
                    if (raw === null) {
                        console.error("No Actions to Rehydrate");
                        return;
                    }
                    const payload = JSON.parse(raw);
                    if (areVersionsCompatible(this.version, payload?.version)) {
                        this.actions = payload.actions;
                    }
                }
            } catch (err) {
                console.error("Issue Rehydrating Actions");
                throw err;
            }
        }

    }

    return Manager;

})));

let op = new Seldon();

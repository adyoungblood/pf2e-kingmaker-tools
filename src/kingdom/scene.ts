import {evaluateStructures, includeCapital, StructureResult} from './structures';
import {ruleSchema} from './schema';
import {CommodityStorage, Structure, structuresByName} from './data/structures';
import {Kingdom, Settlement} from './data/kingdom';
import {Activity} from './data/activities';

class StructureError extends Error {
}


function parseStructureData(name: string | null, data: unknown): Structure | undefined {
    if (data === undefined || data === null) {
        return undefined;
    } else if (typeof data === 'object' && 'ref' in data) {
        const refData = data as { ref: string };
        const lookedUpStructure = structuresByName.get(refData.ref);
        if (lookedUpStructure === undefined) {
            throw new StructureError(`No predefined structure data found for actor with name ${name}, aborting`);
        }
        return lookedUpStructure;
    } else if (name !== null) {
        const rule = {
            name,
            ...data,
        };
        const result = ruleSchema.validate(rule);
        if (result.error) {
            console.error(`Failed to validate structure with name ${name}`, data);
            console.error('Validation Error', result.error);
            throw new StructureError(`Structure with name ${name} failed to validate, aborting. See console log (F12) for more details`);
        }
        return rule;
    } else {
        return data as Structure;
    }
}

function getSceneStructures(scene: Scene): Structure[] {
    try {
        return scene.tokens
            .filter(t => t.actor !== null && t.actor !== undefined)
            .map(t => t.actor)
            .map(actor => parseStructureData(actor!.name, actor!.getFlag('pf2e-kingmaker-tools', 'structureData')))
            .filter(data => data !== undefined) as Structure[] ?? [];
    } catch (e: unknown) {
        if (e instanceof StructureError) {
            ui.notifications?.error(e.message);
        } else {
            throw e;
        }
    }
    return [];
}

export function getScene(game: Game, sceneId: string): Scene | undefined {
    return game?.scenes?.find(scene => scene.id === sceneId);
}

export function getCurrentScene(game: Game): Scene | undefined {
    return game.scenes?.viewed;
}

export interface SettlementAndScene {
    settlement: Settlement;
    scene: Scene;
}

export function getCapitalSettlement(game: Game, kingdom: Kingdom): SettlementAndScene | undefined {
    const settlement = kingdom.settlements.find(settlement => settlement.type === 'capital');
    const scene = settlement ? getScene(game, settlement.sceneId) : undefined;
    if (scene && settlement) {
        return {
            scene: scene,
            settlement: settlement,
        };
    }
}

export function getSettlement(game: Game, kingdom: Kingdom, sceneId: string): SettlementAndScene | undefined {
    const settlement = kingdom.settlements.find(settlement => settlement.sceneId === sceneId);
    const scene = getScene(game, sceneId);
    if (scene && settlement) {
        return {
            settlement,
            scene,
        };
    }
}

export function getAllSettlements(game: Game, kingdom: Kingdom): SettlementAndScene[] {
    return game.scenes
        ?.map(scene => getSettlement(game, kingdom, scene.id))
        ?.filter(scene => scene !== undefined) as SettlementAndScene[] ?? [];
}

function getSettlementStructureResult(settlement: SettlementAndScene): StructureResult {
    const structures = getSceneStructures(settlement.scene);
    return evaluateStructures(structures, settlement.settlement.level);
}


export function getStructureResult(active: SettlementAndScene, capital?: SettlementAndScene): StructureResult {
    if (capital && capital.scene.id !== active.scene.id) {
        return includeCapital(getSettlementStructureResult(capital), getSettlementStructureResult(active));
    } else {
        return getSettlementStructureResult(active);
    }
}

interface MergedSettlements {
    leadershipActivityNumber: number;
    settlementConsumption: number;
    storage: CommodityStorage;
    unlockedActivities: Set<Activity>;
}

export function getAllMergedSettlements(game: Game, kingdom: Kingdom): MergedSettlements {
    return getAllSettlements(game, kingdom)
        .map(settlement => {
            const structureResult = getSettlementStructureResult(settlement);
            return {
                leadershipActivityNumber: structureResult.increaseLeadershipActivities ? 3 : 2,
                settlementConsumption: structureResult.consumption,
                storage: structureResult.storage,
                unlockedActivities: new Set(structureResult.unlockActivities),
            };
        })
        .reduce((prev, curr) => {
            return {
                leadershipActivityNumber: Math.max(prev.leadershipActivityNumber, curr.leadershipActivityNumber),
                settlementConsumption: prev.settlementConsumption + curr.settlementConsumption,
                storage: {
                    ore: prev.storage.ore + curr.storage.ore,
                    stone: prev.storage.stone + curr.storage.stone,
                    luxuries: prev.storage.luxuries + curr.storage.luxuries,
                    lumber: prev.storage.lumber + curr.storage.lumber,
                    food: prev.storage.food + curr.storage.food,
                },
                unlockedActivities: new Set<Activity>([...prev.unlockedActivities, ...curr.unlockedActivities]),
            };
        }, {
            leadershipActivityNumber: 2,
            settlementConsumption: 0,
            storage: {ore: 0, stone: 0, luxuries: 0, lumber: 0, food: 0},
            unlockedActivities: new Set<Activity>(),
        });
}

export interface ActiveSettlementStructureResult {
    active: StructureResult;
    merged: StructureResult;
}

export function getActiveSettlementStructureResult(game: Game, kingdom: Kingdom): ActiveSettlementStructureResult | undefined {
    const activeSettlement = getSettlement(game, kingdom, kingdom.activeSettlement);
    const capitalSettlement = getCapitalSettlement(game, kingdom);
    if (activeSettlement) {
        const activeSettlementStructures = getStructureResult(activeSettlement);
        const mergedSettlementStructures = getStructureResult(activeSettlement, capitalSettlement);
        return {
            active: activeSettlementStructures,
            merged: mergedSettlementStructures,
        };
    }
}

export function getSettlementsWithoutLandBorders(game: Game, kingdom: Kingdom): number {
    return getAllSettlements(game, kingdom)
        .filter(settlementAndScene => {
            const structures = getStructureResult(settlementAndScene);
            return (settlementAndScene.settlement?.waterBorders ?? 0) >= 4 && !structures.hasBridge;
        })
        .length;
}

import { arrayToCompletions } from '../utils/utils'
import { ArgumentParserResult } from '../types/Parser'
import { ClientCache, getCompletions, getSafeCategory, CacheKey } from '../types/ClientCache'
import Config, { VanillaConfig } from '../types/Config'
import { DiagnosticSeverity, CompletionItemKind } from 'vscode-languageserver'
import ArgumentParser from './ArgumentParser'
import Identity from '../types/Identity'
import ParsingError from '../types/ParsingError'
import StringReader from '../utils/StringReader'
import VanillaRegistries, { Registry } from '../types/VanillaRegistries'
import Manager from '../types/Manager'

export default class NamespacedIDArgumentParser extends ArgumentParser<Identity> {
    readonly identity = 'namespacedID'

    /**
     * 
     * @param type A type in registries, or a type in cache if beginning with hash (`$`).
     * @param registries The registries.
     */
    // istanbul ignore next
    constructor(
        private readonly type: string,
        private readonly registries = VanillaRegistries,
        private readonly allowTag = false,
        private readonly isPredicate = false
    ) {
        super()
    }

    parse(reader: StringReader, cursor = -1, manager: Manager<ArgumentParser<any>>, config = VanillaConfig, cache: ClientCache = {}): ArgumentParserResult<Identity> {
        const ans: ArgumentParserResult<Identity> = {
            data: new Identity(),
            errors: [],
            cache: {},
            completions: []
        }
        const getCacheTagType = () => {
            switch (this.type) {
                case 'minecraft:block':
                    return 'tags/blocks'
                case 'minecraft:entity_type':
                    return 'tags/entityTypes'
                case 'minecraft:fluid':
                    return 'tags/fluids'
                case 'minecraft:item':
                    return 'tags/items'
                case '$functions':
                    return 'tags/functions'
                default:
                    throw new Error(`faild to find a tag type for ‘${this.type}’`)
            }
        }
        const start = reader.cursor
        let stringID: string = ''
        let isTag = false

        const tagCandidates: string[] = []
        const regularCandidates: string[] = []
        if (this.allowTag) {
            const type = getCacheTagType()
            const category = getSafeCategory(cache, type)
            tagCandidates.push(...Object.keys(category))
        }
        if (this.type.startsWith('$')) {
            const type = this.type.slice(1)
            regularCandidates.push(...Object.keys(getSafeCategory(cache, type as any)))
        } else {
            const registry = this.registries[this.type]
            regularCandidates.push(...Object.keys(registry.entries))
        }

        //#region Completions
        const namespaces = new Set<string>()
        const folders = new Set<string>()
        const files = new Set<string>()
        if (cursor === reader.cursor) {
            for (const candidate of tagCandidates) {
                const namespace = candidate.split(':')[0]
                const paths = candidate.split(':')[1].split('/')

                namespaces.add(`${Identity.TagSymbol}${namespace}`)
                if (namespace === Identity.DefaultNamespace && !this.isPredicate) {
                    if (paths.length >= 2) {
                        folders.add(paths[0])
                    } else {
                        files.add(paths[0])
                    }
                }
            }
            for (const candidate of regularCandidates) {
                const namespace = candidate.split(':')[0]
                const paths = candidate.split(':')[1].split('/')

                namespaces.add(namespace)
                if (namespace === Identity.DefaultNamespace && !this.isPredicate) {
                    if (paths.length >= 2) {
                        folders.add(paths[0])
                    } else {
                        files.add(paths[0])
                    }
                }
            }
        }
        //#endregion

        //#region Data
        let namespace = Identity.DefaultNamespace
        const paths: string[] = []

        // Whether this is a tag ID.
        if (reader.peek() === Identity.TagSymbol) {
            reader.skip()
            isTag = true
            if (!this.allowTag) {
                ans.errors.push(new ParsingError(
                    { start, end: reader.cursor },
                    'tags are not allowed here'
                ))
            }
        }
        let candidates = isTag ? tagCandidates : regularCandidates

        if (!reader.canRead()) {
            ans.errors.push(new ParsingError({ start, end: start + 1 }, 'expected a namespaced ID but got nothing', false))
        } else {
            // Parse the namespace or the first part of path.
            let path0 = reader.readUnquotedString()
            if (reader.peek() === ':') {
                reader.skip()
                namespace = path0
                // if (namespace === Identity.DefaultNamespace && config.lint.omitDefaultNamespace) {
                //     ans.errors.push(new ParsingError(
                //         { start, end: reader.cursor },
                //         'default namespace is preferred to be omitted',
                //         true,
                //         DiagnosticSeverity.Warning
                //     ))
                // }
                //#region Completions
                candidates = candidates
                    .filter(v => v.startsWith(`${namespace}:`))
                    .map(v => v.slice(namespace.length + 1))
                if (cursor === reader.cursor) {
                    for (const candidate of candidates) {
                        const paths = candidate.split(Identity.Sep)

                        if (paths.length >= 2) {
                            folders.add(paths[0])
                        } else {
                            files.add(paths[0])
                        }
                    }
                }
                //#endregion
                path0 = reader.readUnquotedString()
            } else {
                candidates = candidates
                    .filter(v => v.startsWith(`${Identity.DefaultNamespace}:`))
                    .map(v => v.slice(Identity.DefaultNamespace.length + 1))
                if (this.isPredicate) {
                    ans.errors.push(new ParsingError(
                        { start, end: reader.cursor },
                        'default namespace cannot be omitted here'
                    ))
                }
                // if (!config.lint.omitDefaultNamespace) {
                //     ans.errors.push(new ParsingError(
                //         { start, end: reader.cursor },
                //         'default namespace is preferred to be kept',
                //         true,
                //         DiagnosticSeverity.Warning
                //     ))
                // }
            }
            paths.push(path0)

            // Parse the following paths.
            while (reader.peek() === Identity.Sep) {
                reader.skip()
                //#region Completions
                candidates = candidates.filter(v => v.startsWith(paths.join(Identity.Sep)))
                if (cursor === reader.cursor) {
                    for (const candidate of candidates) {
                        const candidatePaths = candidate.split(Identity.Sep)

                        if (candidatePaths.length - paths.length >= 2) {
                            folders.add(candidatePaths[paths.length])
                        } else if (candidatePaths.length - paths.length === 1) {
                            files.add(candidatePaths[paths.length])
                        }
                    }
                }
                //#endregion
                paths.push(
                    reader.readUnquotedString()
                )
            }

            ans.data = new Identity(namespace, paths, isTag)
            stringID = ans.data.toString()
        }
        //#endregion

        if (reader.cursor - start && stringID) {
            // Check whether the ID exists in cache or registry.
            if (isTag) {
                // For tags.
                const tagType = getCacheTagType()
                const category = getSafeCategory(cache, tagType)
                //#region Errors
                if (this.shouldStrictCheck(tagType, config) && !Object.keys(category).includes(stringID)) {
                    ans.errors.push(new ParsingError(
                        { start, end: reader.cursor },
                        `faild to resolve namespaced ID ‘${stringID}’ in cache category ‘${tagType}’`,
                        undefined,
                        DiagnosticSeverity.Warning
                    ))
                }
                //#endregion

                //#region Cache
                if (Object.keys(category).includes(stringID)) {
                    ans.cache = {
                        [tagType]: {
                            [stringID]: {
                                def: [],
                                ref: [{ start, end: reader.cursor }]
                            }
                        }
                    }
                }
                //#endregion
            } else {
                // For normal IDs.
                if (this.type.startsWith('$')) {
                    // For cache IDs.
                    const type = this.type.slice(1)
                    const category = getSafeCategory(cache, type as any)
                    //#region Errors
                    if (this.shouldStrictCheck(type as CacheKey, config) && !Object.keys(category).includes(stringID)) {
                        ans.errors.push(new ParsingError(
                            { start, end: reader.cursor },
                            `faild to resolve namespaced ID ‘${stringID}’ in cache category ‘${type}’`,
                            undefined,
                            DiagnosticSeverity.Warning
                        ))
                    }
                    //#endregion

                    //#region Cache
                    if (Object.keys(category).includes(stringID)) {
                        const type = this.type.slice(1)
                        ans.cache = {
                            [type]: {
                                [stringID]: {
                                    def: [],
                                    ref: [{ start, end: reader.cursor }]
                                }
                            }
                        }
                    }
                    //#endregion
                } else {
                    // For registry IDs.
                    const registry = this.registries[this.type]
                    //#region Errors
                    if (!Object.keys(registry.entries).includes(stringID)) {
                        ans.errors.push(new ParsingError(
                            { start, end: reader.cursor },
                            `faild to resolve namespaced ID ‘${stringID}’ in registry ‘${this.type}’`,
                            undefined,
                            DiagnosticSeverity.Warning
                        ))
                    }
                    //#endregion
                }
            }
        }

        //#region Completions
        // namespace -> CompletionItemKind.Module
        // folder -> CompletionItemKind.Folder
        // file -> CompletionItemKind.Field
        namespaces.forEach(k => void ans.completions.push({
            label: k,
            kind: CompletionItemKind.Module,
            commitCharacters: [':']
        }))
        folders.forEach(k => void ans.completions.push({
            label: k,
            kind: CompletionItemKind.Folder,
            commitCharacters: ['/']
        }))
        files.forEach(k => void ans.completions.push({
            label: k,
            kind: CompletionItemKind.Field,
            commitCharacters: [' ']
        }))
        //#endregion

        return ans
    }

    /* istanbul ignore next: tired of writing tests */
    private shouldStrictCheck(key: CacheKey, { lint: lint }: Config) {
        switch (key) {
            case 'advancements':
                return lint.strictAdvancementCheck
            case 'functions':
                return lint.strictFunctionCheck
            case 'lootTables':
                return lint.strictLootTableCheck
            case 'predicates':
                return lint.strictPredicateCheck
            case 'recipes':
                return lint.strictRecipeCheck
            case 'tags/blocks':
                return lint.strictBlockTagCheck
            case 'tags/entityTypes':
                return lint.strictEntityTypeTagCheck
            case 'tags/fluids':
                return lint.strictFluidTagCheck
            case 'tags/functions':
                return lint.strictFunctionTagCheck
            case 'tags/items':
                return lint.strictItemTagCheck
            case 'bossbars':
                return lint.strictBossbarCheck
            case 'storages':
                return lint.strictStorageCheck
            default:
                return false
        }
    }

    getExamples(): string[] {
        return ['example:foo/bar']
    }
}

import * as assert from 'power-assert'
import NamespacedIDArgumentParser from '../../parsers/NamespacedIDArgumentParser'
import ParsingError from '../../types/ParsingError'
import StringReader from '../../utils/StringReader'
import { describe, it } from 'mocha'
import { constructConfig } from '../../types/Config'
import { DiagnosticSeverity, CompletionItemKind } from 'vscode-languageserver'
import { Registries } from '../../types/VanillaRegistries'
import Identity from '../../types/Identity'
import { fail } from 'assert'
import ArgumentParserManager from '../../parsers/ArgumentParserManager'

describe('NamespacedIDArgumentParser Tests', () => {
    const registries: Registries = {
        'spgoding:test': {
            protocol_id: 0,
            entries: {
                'spgoding:a': { protocol_id: 0 },
                'spgoding:b': { protocol_id: 1 },
                'spgoding:c': { protocol_id: 2 }
            }
        },
        'minecraft:fluid': {
            protocol_id: 1,
            entries: {
                'minecraft:water': { protocol_id: 0 },
                'minecraft:lava': { protocol_id: 1 }
            }
        },
        'minecraft:item': {
            protocol_id: 2,
            entries: {
                'minecraft:stick': { protocol_id: 0 }
            }
        },
        'minecraft:block': {
            protocol_id: 3,
            entries: {
                'minecraft:stone': { protocol_id: 0 }
            }
        },
        'minecraft:entity_type': {
            protocol_id: 4,
            entries: {
                'minecraft:area_effect_cloud': { protocol_id: 0 }
            }
        },
        'spgoding:seg_completion_test': {
            protocol_id: 5,
            entries: {
                'spgoding:foo': { protocol_id: 0 },
                'spgoding:foo/bar': { protocol_id: 1 },
                'spgoding:foo/bar/baz': { protocol_id: 2 },
                'minecraft:foo': { protocol_id: 3 },
                'minecraft:foo/bar': { protocol_id: 4 },
                'minecraft:foo/bar/baz': { protocol_id: 5 },
            }
        }
    }
    const manager = new ArgumentParserManager()
    describe('getExamples() Tests', () => {
        it('Should return examples', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.getExamples()
            assert.deepStrictEqual(actual, ['example:foo/bar'])
        })
    })
    describe('parse() Tests', () => {
        const cache = {
            bossbars: {
                'spgoding:bossbar/a': { def: [], ref: [] },
                'spgoding:bossbar/b': { def: [], ref: [] }
            },
            'tags/functions': {
                'spgoding:function/1': { def: [], ref: [] },
                'spgoding:function/2': { def: [], ref: [] }
            },
            'tags/fluids': {
                'minecraft:fluid_tag': { def: [], ref: [] }
            },
            'tags/entityTypes': {
                'spgoding:entity_type/1': { def: [], ref: [] },
                'spgoding:entity_type/2': { def: [], ref: [] }
            },
            'tags/blocks': {
                'minecraft:block/1': { def: [], ref: [] }
            },
            'tags/items': {
                'spgoding:item/1': { def: [], ref: [] },
                'spgoding:item/2': { def: [], ref: [] }
            },
            lootTables: {
                'spgoding:loot_table/foo': { def: [], ref: [] }
            }
        }
        const config = constructConfig({
            lint: {
                omitDefaultNamespace: true
            }
        })
        it('Should return data with single path', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.parse(new StringReader('spgoding:a'), undefined, manager)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['a']))
        })
        it('Should return data with multiple paths', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.parse(new StringReader('spgoding:a/b/c'), undefined, manager)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['a', 'b', 'c']))
        })
        it('Should return data without namespace', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.parse(new StringReader('a/b'), undefined, manager, config)
            assert.deepStrictEqual(actual.data, new Identity('minecraft', ['a', 'b']))
        })
        it('Should return data with tag ID', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:fluid', registries, true)
            const actual = parser.parse(new StringReader('#minecraft:fluid_tag'), undefined, manager)
            assert.deepStrictEqual(actual.data, new Identity('minecraft', ['fluid_tag'], true))
        })
        it('Should return completions for registry entries', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.parse(new StringReader(''), 0, manager)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    }
                ]
            )
        })
        it('Should return completions for cache units', () => {
            const parser = new NamespacedIDArgumentParser('$bossbars', registries)
            const actual = parser.parse(new StringReader(''), 0, manager, undefined, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    }
                ]
            )
        })
        it('Should return completions for fluid and fluid tags', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:fluid', registries, true)
            const actual = parser.parse(new StringReader(''), 0, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: '#minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'fluid_tag',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    },
                    {
                        label: 'water',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    },
                    {
                        label: 'lava',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for functions and function tags', () => {
            const parser = new NamespacedIDArgumentParser('$functions', registries, true)
            const actual = parser.parse(new StringReader(''), 0, manager, undefined, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: '#spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    }
                ]
            )
        })
        it('Should return completions for items and item tags', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:item', registries, true)
            const actual = parser.parse(new StringReader(''), 0, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: '#spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'stick',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for blocks and block tags', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:block', registries, true)
            const actual = parser.parse(new StringReader(''), 0, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: '#minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'block',
                        kind: CompletionItemKind.Folder,
                        commitCharacters: ['/']
                    },
                    {
                        label: 'stone',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for entity types and entity type tags', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:entity_type', registries, true)
            const actual = parser.parse(new StringReader(''), 0, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: '#spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'area_effect_cloud',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for namespaces and the first path in default namespace', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:seg_completion_test', registries)
            const actual = parser.parse(new StringReader(''), 0, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'foo',
                        kind: CompletionItemKind.Folder,
                        commitCharacters: ['/']
                    },
                    {
                        label: 'foo',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should only return completions for namespaces when cannot omit namespaces', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:seg_completion_test', registries, undefined, true)
            const actual = parser.parse(new StringReader(''), 0, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'spgoding',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    }
                ]
            )
        })
        it('Should return completions for the first path in non-default namespace', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:seg_completion_test', registries)
            const actual = parser.parse(new StringReader('spgoding:'), 9, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['']))
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'foo',
                        kind: CompletionItemKind.Folder,
                        commitCharacters: ['/']
                    },
                    {
                        label: 'foo',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for the second path in non-default namespace', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:seg_completion_test', registries)
            const actual = parser.parse(new StringReader('spgoding:foo/'), 13, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['foo', '']))
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'bar',
                        kind: CompletionItemKind.Folder,
                        commitCharacters: ['/']
                    },
                    {
                        label: 'bar',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for the third path in non-default namespace', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:seg_completion_test', registries)
            const actual = parser.parse(new StringReader('spgoding:foo/bar/'), 17, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['foo', 'bar', '']))
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'baz',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for the second path in default namespace', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:seg_completion_test', registries)
            const actual = parser.parse(new StringReader('foo/'), 4, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity(undefined, ['foo', '']))
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'bar',
                        kind: CompletionItemKind.Folder,
                        commitCharacters: ['/']
                    },
                    {
                        label: 'bar',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return untolerable error when the input is empty', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.parse(new StringReader(''), undefined, manager)
            assert.deepStrictEqual(actual.data, new Identity())
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 1 }, 'expected a namespaced ID but got nothing', false)
            ])
        })
        it('Should return warning when the id cannot be resolved in cache category', () => {
            const config = constructConfig({ lint: { strictBossbarCheck: true, omitDefaultNamespace: true } })
            const parser = new NamespacedIDArgumentParser('$bossbars', registries)
            const actual = parser.parse(new StringReader('foo'), undefined, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity(undefined, ['foo']))
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 3 }, 'faild to resolve namespaced ID ‘minecraft:foo’ in cache category ‘bossbars’', undefined, DiagnosticSeverity.Warning)
            ])
        })
        it('Should return warning when the id cannot be resolved in loot table cache', () => {
            const config = constructConfig({ lint: { strictLootTableCheck: true, omitDefaultNamespace: true } })
            const parser = new NamespacedIDArgumentParser('$lootTables', registries)
            const actual = parser.parse(new StringReader('foo'), undefined, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity(undefined, ['foo']))
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 3 }, 'faild to resolve namespaced ID ‘minecraft:foo’ in cache category ‘lootTables’', undefined, DiagnosticSeverity.Warning)
            ])
        })
        it('Should return warning when the id cannot be resolved in tag cache category', () => {
            const config = constructConfig({ lint: { strictFunctionTagCheck: true, omitDefaultNamespace: true } })
            const parser = new NamespacedIDArgumentParser('$functions', registries, true)
            const actual = parser.parse(new StringReader('#spgoding:function/114514'), undefined, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['function', '114514'], true))
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 25 }, 'faild to resolve namespaced ID ‘spgoding:function/114514’ in cache category ‘tags/functions’', undefined, DiagnosticSeverity.Warning)
            ])
        })
        it('Should return warning when the id cannot be resolved in registry', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries)
            const actual = parser.parse(new StringReader('qux'), undefined, manager, config)
            assert.deepStrictEqual(actual.data, new Identity(undefined, ['qux']))
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 3 }, 'faild to resolve namespaced ID ‘minecraft:qux’ in registry ‘spgoding:test’', undefined, DiagnosticSeverity.Warning)
            ])
        })
        // it('Should return warning when the default namespace are preferred to be omitted', () => {
        //     const parser = new NamespacedIDArgumentParser('minecraft:block', registries)
        //     const actual = parser.parse(new StringReader('minecraft:stone'), undefined, manager, config)
        //     assert.deepStrictEqual(actual.data, new Identity('minecraft', ['stone']))
        //     assert.deepStrictEqual(actual.errors, [
        //         new ParsingError({ start: 0, end: 10 }, 'default namespace is preferred to be omitted', undefined, DiagnosticSeverity.Warning)
        //     ])
        // })
        // it('Should return warning when the default namespace are preferred to be kept', () => {
        //     const config = constructConfig({ lint: { omitDefaultNamespace: false } })
        //     const parser = new NamespacedIDArgumentParser('minecraft:block', registries)
        //     const actual = parser.parse(new StringReader('stone'), undefined, manager, config)
        //     assert.deepStrictEqual(actual.data, new Identity(undefined, ['stone']))
        //     assert.deepStrictEqual(actual.errors, [
        //         new ParsingError({ start: 0, end: 5 }, 'default namespace is preferred to be kept', undefined, DiagnosticSeverity.Warning)
        //     ])
        // })
        it('Should return cache when the id is already defined', () => {
            const parser = new NamespacedIDArgumentParser('$bossbars', registries)
            const actual = parser.parse(new StringReader('spgoding:bossbar/a'), undefined, manager, undefined, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['bossbar', 'a']))
            assert.deepStrictEqual(actual.cache, {
                bossbars: {
                    'spgoding:bossbar/a': {
                        def: [],
                        ref: [{ start: 0, end: 18 }]
                    }
                }
            })
        })
        it('Should return empty cache when the id is undefined', () => {
            const parser = new NamespacedIDArgumentParser('$bossbars', registries)
            const actual = parser.parse(new StringReader('spgoding:bossbar/c'), undefined, manager, undefined, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['bossbar', 'c']))
            assert.deepStrictEqual(actual.cache, {})
        })
        it('Should throw error when the type does not have a corresponding tag type', () => {
            const parser = new NamespacedIDArgumentParser('spgoding:test', registries, true)
            try {
                parser.parse(new StringReader('#'), 1, manager)
                fail()
            } catch (e) {
                assert(e.message === 'faild to find a tag type for ‘spgoding:test’')
            }
        })
        it('Should throw error when tags are not allowed here', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:entity_type', registries)
            const actual = parser.parse(new StringReader('#spgoding:entity_type/1'), undefined, manager, undefined, cache)
            assert.deepStrictEqual(actual.data, new Identity('spgoding', ['entity_type', '1'], true))
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 1 }, 'tags are not allowed here')
            ])
        })
        it('Should throw error when namespace cannot be omitted here', () => {
            const parser = new NamespacedIDArgumentParser('minecraft:block', registries, undefined, true)
            const actual = parser.parse(new StringReader('stone'), undefined, manager, config, cache)
            assert.deepStrictEqual(actual.data, new Identity(undefined, ['stone']))
            assert.deepStrictEqual(actual.errors, [
                new ParsingError({ start: 0, end: 5 }, 'default namespace cannot be omitted here')
            ])
        })
    })
})

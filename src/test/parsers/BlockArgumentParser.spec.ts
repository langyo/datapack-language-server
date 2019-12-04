import * as assert from 'power-assert'
import { describe, it } from 'mocha'
import ArgumentParserManager from '../../parsers/ArgumentParserManager'
import Block from '../../types/Block'
import BlockArgumentParser from '../../parsers/BlockArgumentParser'
import Identity from '../../types/Identity'
import ParsingError from '../../types/ParsingError'
import StringReader from '../../utils/StringReader'
import { getNbtCompoundTag, getNbtStringTag } from '../../types/NbtTag'
import { CompletionItemKind } from 'vscode-languageserver'
import { constructConfig } from '../../types/Config'

describe('BlockArgumentParser Tests', () => {
    describe('getExamples() Tests', () => {
        it('Should return examples', () => {
            const parser = new BlockArgumentParser()
            const actual = parser.getExamples()
            assert.deepEqual(actual, ['stone', 'minecraft:stone', 'stone[foo=bar]', 'stone{bar:baz}'])
        })
    })
    describe('parse() Tests', () => {
        const blockDefinitions = {
            'minecraft:stone': {
                properties: {
                    snowy: ['true', 'false'],
                    age: ['0', '1', '2', '3']
                },
                states: [{
                    id: 0,
                    properties: {}
                }]
            },
            'minecraft:grass_block': {
                states: [{
                    id: 1,
                    properties: {}
                }]
            }
        }
        const registries = {
            'minecraft:block': {
                protocol_id: 0,
                entries: {
                    'minecraft:stone': { protocol_id: 0 },
                    'minecraft:grass_block': { protocol_id: 1 }
                }
            }
        }
        const manager = new ArgumentParserManager()
        it('Should return data without states or tag', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone'), undefined, manager)
            assert.deepEqual(actual.errors, [])
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone'])
            ))
        })
        it('Should return data with empty states', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[]'), undefined, manager)
            assert.deepEqual(actual.errors, [])
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone'])
            ))
        })
        it('Should return data with single state', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[ snowy = true ]'), undefined, manager)
            assert.deepEqual(actual.errors, [])
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone']),
                { snowy: 'true' }
            ))
        })
        it('Should return data with multiple states', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[ snowy = true , age = 3 ]'), undefined, manager)
            assert.deepEqual(actual.errors, [])
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone']),
                { snowy: 'true', age: '3' }
            ))
        })
        it('Should return data with tag', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone{ foo : "bar" }'), undefined, manager)
            assert.deepEqual(actual.errors, [])
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone']),
                undefined,
                getNbtCompoundTag({ foo: getNbtStringTag('bar') })
            ))
        })
        it('Should return data with both states and tag', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[ snowy = true , age = 2 ]{ foo : "bar" }'), undefined, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone']),
                { snowy: 'true', age: '2' },
                getNbtCompoundTag({ foo: getNbtStringTag('bar') })
            ))
        })
        it('Should return completions at the beginning of input', () => {
                const config = constructConfig({ lint: { omitDefaultNamespace: true } })
                const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader(''), 0, manager, config)
            assert.deepEqual(actual.data, new Block(
                new Identity()
            ))
            assert.deepStrictEqual(actual.completions,
                [
                    {
                        label: 'minecraft',
                        kind: CompletionItemKind.Module,
                        commitCharacters: [':']
                    },
                    {
                        label: 'stone',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    },
                    {
                        label: 'grass_block',
                        kind: CompletionItemKind.Field,
                        commitCharacters: [' ']
                    }
                ]
            )
        })
        it('Should return completions for state keys', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[]'), 16, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone'])
            ))
            assert.deepStrictEqual(actual.completions,
                [
                    { label: 'snowy' },
                    { label: 'age' }
                ]
            )
        })
        it('Should not return redundant completions for state keys', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[snowy=true,]'), 27, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone']),
                { snowy: 'true' }
            ))
            assert.deepStrictEqual(actual.completions,
                [
                    { label: 'age' }
                ]
            )
        })
        it('Should return completions for state values', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[snowy=]'), 22, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone']),
                { snowy: '' }
            ))
            assert.deepStrictEqual(actual.completions,
                [
                    { label: 'true' },
                    { label: 'false' }
                ]
            )
        })
        it('Should return empty completions if the ID does not have states', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('grass_block[]'), 12, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['grass_block'])
            ))
            assert.deepStrictEqual(actual.completions, [])
        })
        it('Should return empty completions if the ID does not exist', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('spgoding:wtf[]'), 13, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('spgoding', ['wtf'])
            ))
            assert.deepStrictEqual(actual.completions, [])
        })
        it('Should return error for dupliate keys', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[snowy=true,snowy=false]'), 0, manager)
            assert.deepStrictEqual(actual.errors,
                [
                    new ParsingError(
                        { start: 27, end: 32 }, 'expected ‘age’ but got ‘snowy’'
                    ),
                    new ParsingError(
                        { start: 27, end: 32 }, 'duplicate key ‘snowy’'
                    )
                ]
            )
        })
        it('Should return error when the end bracket is missing', () => {
            const parser = new BlockArgumentParser(false, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('minecraft:stone[snowy='), 0, manager)
            assert.deepStrictEqual(actual.errors,
                [
                    new ParsingError(
                        { start: 22, end: 23 }, 'expected ‘true’ or ‘false’ but got nothing'
                    ),
                    new ParsingError(
                        { start: 22, end: 23 }, 'expected ‘]’ but got nothing'
                    )
                ]
            )
        })
        it('Should not return errors for block tags', () => {
            const parser = new BlockArgumentParser(true, blockDefinitions, registries)
            const actual = parser.parse(new StringReader('#minecraft:stone[snowy=true]'), undefined, manager)
            assert.deepEqual(actual.data, new Block(
                new Identity('minecraft', ['stone'], true),
                { snowy: 'true' }
            ))
            assert.deepStrictEqual(actual.errors, [])
        })
    })
})

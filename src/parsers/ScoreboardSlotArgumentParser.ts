import ArgumentParser from './ArgumentParser'
import Manager from '../types/Manager'
import StringReader from '../utils/StringReader'
import { ArgumentParserResult, combineArgumentParserResult } from '../types/Parser'
import ParsingError from '../types/ParsingError'

export default class ScoreboardSlotArgumentParser extends ArgumentParser<string> {
    static readonly Category = ['belowName', 'list', 'sidebar']
    static readonly Colors = ['black', 'dark_blue', 'dark_green', 'dark_aqua', 'dark_red', 'dark_purple', 'gold', 'gray', 'dark_gray', 'blue', 'green', 'aqua', 'red', 'light_purple', 'yellow', 'white']
    static readonly Sep = '.'

    readonly identity = 'scoreboardSlot'

    constructor() {
        super()
    }

    parse(reader: StringReader, cursor = -1, manager: Manager<ArgumentParser<any>>): ArgumentParserResult<string> {
        const ans: ArgumentParserResult<string> = {
            data: '',
            errors: [],
            cache: {},
            completions: []
        }

        const categoryResult = manager.get('Literal', ScoreboardSlotArgumentParser.Category).parse(reader, cursor)
        const category = categoryResult.data as 'list' | 'sidebar' | 'belowName' | ''
        combineArgumentParserResult(ans, categoryResult)

        if (category && reader.peek() === ScoreboardSlotArgumentParser.Sep) {
            if (category !== 'sidebar') {
                ans.errors.push(new ParsingError(
                    { start: reader.cursor, end: reader.cursor + 1 },
                    'only ‘sidebar’ has sub slots'
                ))
                ans.data = category
            } else {
                reader.skip()
                const teamResult = manager.get('Literal', ScoreboardSlotArgumentParser.Colors.map(v => `team${ScoreboardSlotArgumentParser.Sep}${v}`)).parse(reader, cursor)
                const team = teamResult.data as string
                combineArgumentParserResult(ans, teamResult)
                ans.data = `${category}${ScoreboardSlotArgumentParser.Sep}${team}`
            }
        } else {
            ans.data = category
        }

        return ans
    }

    getExamples(): string[] {
        return ['belowName', 'sidebar.team.red']
    }
}

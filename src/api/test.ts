import { AudioPlayer, CommandManageUtils, NativeAPI, PanelCoordinator, StreamAudioPlayer } from '@enconvo/api';

/**
 * @param req
 * @private
 * @returns
 */
export default async function main(req: Request) {
    // await AudioPlayer.play('/Users/ysnows/.enconvo/workspace/Stream-play-texts/1a49634a3da4cd29f3080aecd6b90017/19f94b04-4a42-40ed-9d71-e90ca625702b.wav')
    // NativeAPI.callCommand('voice_input|audio_record')
    PanelCoordinator.openPanel({
        panel:'guide'
    })

    return ''

    const body = await req.json()

    const config = await CommandManageUtils.loadCommandConfig({
        commandKey: 'agent|main',
        includes: ["llm", "auto_audio_play", 'title'],
        useAsRunParams: true
    }) as any;

    console.log('config', JSON.stringify(config, null, 2))
    return config

    if (body.type === 'stop') {
        await StreamAudioPlayer.stop();
        return "stoped"
    }

    // await AudioPlayer.play('/Users/ysnows/.enconvo/workspace/Stream-play-texts/53c4315e520032e67102b2f515d3ab67/50c3ef48-ad30-42f1-90c6-a41bb6dc61b3.mp3')
    // return ''

    // Simulate LLM streaming with fixed chunks
    await StreamAudioPlayer.start();

    const chunks = [
        'I', '\u2019m', ' M', 'avis', ' \u2014', ' not', ' from', ' a', ' place',
        ',', ' really', '.', ' I', '\u2019m', ' part', ' of', ' your', ' En',
        'con', 'vo', ' setup', ' on', ' this', ' Mac', ',', ' so', ' the',
        ' honest', ' answer', ' is', ':', ' here', '.',
    ];

    console.log('new chuncks')

    for (const chunk of chunks) {
        await StreamAudioPlayer.delta(chunk);
    }

    await StreamAudioPlayer.done();
    // console.log('[test] stream done');

    return {};
}

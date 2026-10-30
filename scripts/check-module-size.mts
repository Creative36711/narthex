import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const MODULE_LIMIT = 450
const FACADE_LIMIT = 600
const ENGINE_PATH = 'src/core/engine.ts'
const EXTERNAL_DEBT = ['src/core/combat.ts', 'src/core/savemigrate.ts'] as const
const sourceExtensions = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i

/** Content baseline from origin/main at cfd94af; independent of .git history and refs. */
const BASELINE_SOURCE_SHA256: Readonly<Record<string, string>> = {
  'packs/adventure/hooks.ts': '71c615f0d6b18f4f7b6c80c80c3a2bf828f39c38bd03b43323dc88627fd93d47',
  'packs/adventure/sim.ts': '5d004ae31c8cb23cc9e8bc06b4cafd00eb9fcd066bcacb5d6f70b48f377477a7',
  'packs/adventure/state.ts': '1bd2f656c582ab7ee6358eb01da7b7a68d57d1dfd19464a9cbb12f0789691cae',
  'packs/adventure/types.ts': 'f2ae1df27831d0060ffdd007f245e9a55fe1ef1e3b46d2a0e2dd088efdd07d86',
  'packs/adventure/validate.ts': '07ce9cf1adf73b5b05e9e903005aae6a00e947fdfca895caf8ffc18a61ca6e80',
  'packs/adventure/view.ts': '40051f151289100e15a1d4b7a156a4da95ca5a9651ff885eb5d80859812c6303',
  'packs/fixtures/cross-pack-import/src/index.ts': '876d3f95dd7db8cb618f474b17beeeeddd77c46c487976295ecb9e22ca005a18',
  'packs/fixtures/full/hooks.ts': '7b9d7bad9f6f82dc58fd8247e250825aced389b0eabb3bdfabe57a0af63fdba5',
  'packs/narrative/dialogue-runtime.ts': '393a0b1b4c9648c0cc89cd3f22968cda85818e3e1e19d7d1eec32c2995629c1e',
  'packs/narrative/dialogue.ts': '226adad98d9c83885fa4d3c9b32edbef6a3b828fa576f0045acc0e9d296d60a9',
  'packs/narrative/director.ts': '284f6abbd843cb893e8cb99ae41fe5d7858a94ac6d68fac732f1f3c596b9c2cb',
  'packs/narrative/encounters.ts': 'd1c16945c618cf55796ff5828bb040e5c237ef4d360f0985ba6d7eb70ba17104',
  'packs/narrative/fmv-loader.ts': '6dc92084394ea4199464033e14364beb1992902fef17bb26f4c726ca10899f4b',
  'packs/narrative/fmv.ts': 'e859649f98044475bd537f48893bb520826e187c5e1fc7b96f632a52cf0d7207',
  'packs/narrative/hooks.ts': '5d6bf53feb5c99bb7e23a92f01383f5d695abe884d26129a4c3e8614f69907ec',
  'packs/narrative/index.ts': 'adfac4633bf8486f53bc62e1ecf6887875994893c8196f90770ddc6262e8bea9',
  'packs/narrative/operations.ts': '370e47f3b16f9401813c4a455667957f0d11c3b1f7011f233fbc0116b3187eb8',
  'packs/narrative/probes/campaign.mts': 'c5f3ede88863e69079d1781bf531ce37e7ff2f86b55a1c80f784a8cc5f0e2ae9',
  'packs/narrative/quests.ts': 'fe78407a66ce13d1cd44b8c056af1c7a17000572fa14e7e95fa0277571bae1ac',
  'packs/narrative/roguelike.ts': 'd53d980f643cb819780c0d95526f6559c29b8a4291f5ee7139ad686a555e1d06',
  'packs/narrative/runtime.ts': '89134561f706dad7a2e24737d0a8df68d2ef36fefcbea28969a5975b44967f68',
  'packs/narrative/scene-slots.ts': '877d45819823c0081a6150915bda671a1309d2a71c0780cf1ba8a52045e723d1',
  'packs/narrative/sim.ts': '4a8c7c717312384774884dad7d4aead72961fcde4c4dae68c19ee3d444633db9',
  'packs/narrative/social.ts': 'ee8a6fe6d61a582a412d4ab2d0ab9f53e2ce847bb1341b9a9f042d5fc76d790c',
  'packs/narrative/types.ts': '242b16429a2d360048e6b38f2ff36d367a4bde6cb3964ec68768f209fa894d11',
  'packs/narrative/view.ts': '4bc431e24d52e3ea1fd225fcef6bf00d0451391836bb925337645aaebfd01fd8',
  'packs/narrative/world.ts': '2b4d7ff214380e76deffb327274d898fc1522357fda6f7868031faaedff8f7b7',
  'src/App.tsx': '59fc928ccd13cb4a97ff85700f39f7087824f29b867ac0470711205b98cd0d3e',
  'src/core/brp.ts': 'd77f7736736dcbe90e699a1b19f5f787028df7688d908c9c41ec775185861a9f',
  'src/core/caps.ts': 'b573be0bdb5572eeede0b9a68254f7c715b36daf78b532671f05db6e985649a4',
  'src/core/character.ts': 'd8536d171f371a2b8de41fb867e7d818a07c20f58d9750df159018b78d02f0ba',
  'src/core/charcreate.ts': '7b87f1a548690bba2504f0e2f6826d2d9865da86eace6bff611c78744ecc8342',
  'src/core/checks.ts': 'ad19c1c590a7793e3bb6625cea897578b111aa5368b071a13b8abd1375086dd7',
  'src/core/combat.ts': '903c70bccfbc69c472e97f65f0fe07da659b98028c0a94ded9d369601b1a25fc',
  'src/core/conditions.ts': 'd2cc661a612711684d4c3d516cf1cbff354e09cc5957403994a7e375509796f1',
  'src/core/context.ts': '3454aa32cf0dbda6bcd9c98ee96f8537d1aaebbb84b5dea234823fca466a3fd3',
  'src/core/dice.ts': 'ed8ed1f17a77f4a42b8cff72ba4693c431b1ff164122c5340ac0dbc810287e6e',
  'src/core/economy.ts': '1435b1db15881b9c32372e157f8bb3401c763c5ffbd2c8493e47fc85e52fff4b',
  'src/core/effects.ts': '3a2733219cad74e1be1a14374195ba8f1fa2e8908d25ac77ec764c5487e71b6d',
  'src/core/engine.ts': 'a67c384d2974121b1b1274ead8b652df21620164c93c90c1f444425918885fd7',
  'src/core/equipment.ts': '4455da73b92f6270388807cd95b38d557ee42cea0167eacac0f65a211e79485b',
  'src/core/hex.ts': 'b1b80e08650a23274883fd5dc5ad6ab8e0fc3048014e9d0a11f84b6ed5e92063',
  'src/core/inventory.ts': 'b0db607f75097fd81a875e0f4ee12c4a164fee7d092c90ab7403e5884d3d1bce',
  'src/core/loader.ts': '5e0c5dc4cf5f50972bf9b446a9c7f9e4e961d461e6017d0fb06f0f04d6fff642',
  'src/core/meta.ts': 'ffca6868d7056c98aa2c5e739590ae511be772bb6330be383744b6c4b0228d99',
  'src/core/needs.ts': '5e3dc31fc635d9a980e86e01effc2b25bc8a2fcad657927dba3dd55eb77eec04',
  'src/core/pack/capability-modes.ts': 'f402bab82b6e5765995393beba106e26f7b8d6f946482f04548b0466f725e85d',
  'src/core/pack/host.ts': 'a3e731d097d8df042880784f315c244cbd34397b3fdb4f2741a3702014f17db7',
  'src/core/pack/registry.ts': '5050a3f604aaeda7d96d19039bd9108ef7628d692f2282eee0dfa8426511d288',
  'src/core/party.ts': '35c3b29a856a47c3fdbee876ba087d984279ddc6d0ba0c3d967d3e92f18d9efd',
  'src/core/prng.ts': '8e8eba8704f52de9f52dcb59ce2e9cff7800416fc22ecc25b61e12b126d74360',
  'src/core/savemigrate.ts': '6412b8071e5276f7fd038cb109494696ef79ee7cea4f1ca3d8c125737f1770bc',
  'src/core/time.ts': '92e9454394359c2160a78fc6424218289ccdeaecc2873cdf2147bebae81ea428',
  'src/editor/AiWizard.tsx': 'a53128de49f6b21214b58dcefa6237d87003754dabca57fad13223611b06b5d1',
  'src/editor/ArenaEditor.tsx': 'ad28a41410662f797cd5ecb61c46caefc250054436911a9365271973fc8139db',
  'src/editor/AtmosEditors.tsx': '66ae209f1f19df2432d5f20176e2b3975ea97ffdfc8ae1d6c7ea6498a0544fe7',
  'src/editor/AudioSection.tsx': 'ef71a0ad78c3df20f6ec03300b8be93c059ce76e6e96a1d4171c593e9589a0ce',
  'src/editor/CampaignAuditDialog.tsx': 'f8a7fce7c237e563498c60c16673eed0b99de3efcf6801fe491b52b8ddf42f20',
  'src/editor/CampaignEditor.tsx': '89d2c3bc2b63979f0ac0e2797eff4fe28c14fcee7db4cb85212040d1adea8d9c',
  'src/editor/CodexEditor.tsx': '7799fbd89d0f038328b8c9663def7120187f37bb63fdd91bb14f7ce50b569075',
  'src/editor/CombatRulesEditor.tsx': '08ef7d10990cffcd13914feed55da0403f09c208b319595336c75ee907aa8048',
  'src/editor/CutsceneEditor.tsx': '05d0386691f03338ba2daa2a397a5fc8c27999e45a81476277b48679adc18050',
  'src/editor/DesignDocPanel.tsx': '8ba0cdf1e6ee444a47ede92daaef09a501a9b0f6e3f14151422f50c2ff3c59ce',
  'src/editor/DialogueBuilder.tsx': 'aae7d7afbefc041ed68b0ed7465d9e3294ac7cad695df49099b3c01eb7b9ba68',
  'src/editor/DialogueHost.tsx': '1d8ba18e00f8f70a65d7a81a3f01d9d56d99da98ff2876104d439b04bd86d928',
  'src/editor/DialoguePlaytest.tsx': '7716dd4952f36de6329618a39261f05f61c02294a93e2d517d9f3539917d5c18',
  'src/editor/DialogueScriptView.tsx': '56e7b222c04e131b299dcad396aaf43ff7d04440bce697ed87e87b7401d424e4',
  'src/editor/EditorApp.tsx': '6e6094b38a564490135a15eb63e248d7b66272620a3fc0f56360ff2538b76d9c',
  'src/editor/EditorBookPanel.tsx': '4d0cd6247e209ad6607a2ec4470c88eb9103724111430a1ff5bf5eb21bcee1c7',
  'src/editor/EntityEditor.tsx': 'ecc0db91189685a1f094f3131b17b4a795ed4905b632327661d19c630e7e89f0',
  'src/editor/Fields.tsx': '4da9ef046e0ac34d4838ab07fc62e0358ef872b02c3ee374b3658fe6554b4ac9',
  'src/editor/FlagAutocomplete.tsx': 'cd05b6a45df1ba388fec088f3ee05c97bc16d7fffa3709c921cbbf835ffd3a7e',
  'src/editor/MarkdownView.tsx': '9f3017dd17900e50f065061614f9014614f4bcb9f29b081830da846499cbc226',
  'src/editor/MonacoEditors.tsx': '5872bcabaac2ec810e3cac8ad98c4759ba5e7dba493126891e74f38cbec61787',
  'src/editor/PackCatalogPanel.tsx': '263d49348b32291d967513f4b04fd06cb30c94dfddcc4aa7f665a5ad1c16b274',
  'src/editor/PackMissingNotice.tsx': '822519f545aac03198da61e85264a675f184d443181dc2a8837862dfb9a99337',
  'src/editor/PackPanelWorkbench.tsx': '58c6e41cfe739523a4c5cba4086ccf168bf9455bf05a097f1b5ab2466391e5ed',
  'src/editor/PlaytestDebugPanel.tsx': '932acc461ffd2f45df40ee7073ef68ec0399f32788b7ff24a4cfdf37c1119fdf',
  'src/editor/QuestEditor.tsx': '0f159ea14d99c8bbb2da7f5c8fe94ee9619db3ab98ad29122aaeccb28b066dce',
  'src/editor/RecipeEditor.tsx': 'a8e700ab09c4ac9938b2fe96d2ca5b3e3d5fd3bf2f32fd5b546f8fc1edfee5a8',
  'src/editor/RuleEditor.tsx': 'f2f10fd383acc94759e844d22647f48cf158aecea950ad37c83b347f7c51ad23',
  'src/editor/SceneEditor.tsx': '24a83fe37d827105e87d6fc5342dacb3d28063d66a268659b63280fd7763ba72',
  'src/editor/WorldEditor.tsx': '583bbf911d8c569462735770275e09518fed5f4e9c067d47c1165781eed6114d',
  'src/editor/aiKit.ts': '451a4bc436d6acc2a16b05bd7c012db064a1cd4683b9ade6481149db8883e715',
  'src/editor/aiPrompt.ts': '50dd44bf45c7133673adda2a56482c073d7e286a7ce03132cc8ca6480b6dbe5f',
  'src/editor/aiTask.ts': 'ac3ca41753b679d3aed484c993fde8575b7de66e8c8b910a871543b50bbff340',
  'src/editor/assets.ts': '18fb0c63b722a20a6a533c02b14222710b15896590474f835fce83fb6745fac2',
  'src/editor/campaignAudit.ts': '48c95f02c8a32060fb6fa0938a85493074532c55c60b1c6f71311362088afc66',
  'src/editor/chronicle.ts': 'd0fcdad8689cfc4a3431c0204e96036740548170f13c1a92aa1bc6caec1c003b',
  'src/editor/chronicleIdentity.ts': 'c58551f85b8fa2691c493f0dcdeed7e1544ac4a2caf3c014ce12f9f9cb114aeb',
  'src/editor/chronicleManifest.ts': 'dc160e816d3a489a9958bf248eed16f8bd3dee001b049b18fc8614f7b366910a',
  'src/editor/compatPublish.ts': 'ff4381acbe4f2d76c80846e800e62586ffe20e788e267232d00aafc6c9e678bb',
  'src/editor/dialogueDoc.ts': '33dde56871d754f4fa8eb96eca2c42f921b1354112a9455ae434290ec0e5cb66',
  'src/editor/dialogueIndex.ts': '9e3a6ff4e3129d73c79f60c9f95d138328e76f98ad4742303686c31d476bb4cb',
  'src/editor/dlgScript.ts': 'd8cdfeea3069ca1dcd97aaf207b437b7de08cdc4e32cf2d09bc517bb3b828aea',
  'src/editor/engineVersionRepair.ts': 'e3fc525aba353561a12f3556e62e01d5642c4c5aa95135383c14fb3a615041a0',
  'src/editor/ids.ts': '93c64fdcacd159d7e2cfd161caeefd00acec9264e4e6bcb396b7853e94da099a',
  'src/editor/inkImport.ts': '5bd1fd652c16691f0f997c8e494cb7fa20c063b1280618faec0de16de06c81d7',
  'src/editor/monacoSetup.ts': 'd6464c6df15bc25072961a17b880fc51090a8c22dffcd161943549adf5ea72d7',
  'src/editor/monolith.ts': 'd963f311b921dcad36e06b44439a05c3ebe0298befda7df5b5e7a075c5f5943c',
  'src/editor/newCampaign.ts': '6d5e0e54f4f9e3cd73af17314d49e15cbeac6c46422ff03747ef867e29989e2a',
  'src/editor/packCatalog.ts': 'dd84a15c9ea2caf5b2a6fe3f0be9cc1e5d0a74824a9e18e2a008171a8ab1f0f0',
  'src/editor/packPanels.ts': '63f99d219ebd6bf73c5b3941bd8a043cbae15ae271b0e4d652653f2ee2aaf48d',
  'src/editor/playtest.ts': 'b90dd651fa978604c8bbac93420bf012c6a2feac80b7f47a41b38d7560db6147',
  'src/editor/playtestNotes.ts': '45508bd5c7b89a797391dbac2e0b775562faf7854c48abfaef4f1c825dce9bc1',
  'src/editor/prompt.tsx': '31288d944bd0c99b4d0f91b526310ee942d4ca411279d85d65df8b0778b0126a',
  'src/editor/questJournal.ts': '7687af8a818bea60b5d9a6af828ac7cea2b40856d1c0e66f36fec8640dd15830',
  'src/editor/schemas.ts': '75937213a66adc502f7a2700623d7e1eec8ad19e2288ecb5d2a087e939f90992',
  'src/editor/slotTypes.ts': '4c33d715e534423b7d0681fbc06f84544628ec72bd3d0cc1d43beaec19c9abcb',
  'src/editor/store.ts': 'ae7a67476142a1729d18fd1866ca51d8b7f30c1f2c057f3e3814dbd0930e1a0f',
  'src/main.tsx': '31b55c743889f4eb3b86d05241111b3d84c2f4a060f9382f5ab9ac35ed563bd5',
  'src/player/AdventureScreen.tsx': '91d4a389fd1871604e7e38ed8eda0fd2283f381f6cd723d06482f18146f230f1',
  'src/player/Atmosphere.tsx': 'bf66952bd23eb968d0c05f94c802dcb1e9a7b09237306cb345180854f7f48494',
  'src/player/CharacterCreation.tsx': '5537f79ccc66110d23613cc7717affa3f710defd5077677aed61677c65afcb1a',
  'src/player/CodexPanel.tsx': '24396094c8b345d7d83db4449ba36ed3de4c6cf42725fd26b3caf0d2dc0fd300',
  'src/player/CombatScreen.tsx': 'e88e18519c6d1a3fc4c0ea73f6021296df9614f0bc75b47c5c2fa8e2e3ff251a',
  'src/player/CutsceneYoutube.tsx': 'a3e1081f5a6562f25832fe8e61a4ce31a3d411054b98152af529120c64ef8bbb',
  'src/player/DialogueOverlay.tsx': 'cec28d86d852e99a4bd22786e81f292c22e6b74cac8f78c3a9d9869674a747fa',
  'src/player/DurationModal.tsx': '3ad10980bd9ed5dcad83220649d7d04f78dbf765c0a82d9d7d7b335802aa2f19',
  'src/player/EndScreen.tsx': '4bf2da42f02c6f64ffbea75e54e59dd034cd1401a51e81cf66d0a43aaa5bba20',
  'src/player/FmvCutsceneMode.tsx': '13fd815922ba3cb91eb3eb59c6d5273004defb817c83fb9b862b205db5615ec7',
  'src/player/FmvScreen.tsx': '3c73e87699938b2264b6a2762726c1aebbd12c207109fc47a7486fbc6f903efe',
  'src/player/GameView.tsx': '9dcbd95fbca3062df1efdc33ebba1727521319a0f11dfa4119988ee24dccb3ae',
  'src/player/HUD.tsx': '8c35a2765a219e422b4381acb77ca52090bdea0649a7b1e7ebd5bda1309c3dcc',
  'src/player/HelpPanel.tsx': '7ca4d5280908b628a320a95c06029b956f101f03384f744b0e5071f3e891fb86',
  'src/player/MainMenu.tsx': '53f73886aceb1e00ede3f7a954b6e48d6daad9e22ed019bee60855dfa3054848',
  'src/player/MapScreen.tsx': 'a60b78b1b32b6a8c3a8b536bf738e15f48db86a7cd12f370cef653309a5115c3',
  'src/player/MetaPanel.tsx': '7d39b692369e6fa1843a838f69a6ad15556c9d6ba0c15621c522fc957ee8bbec',
  'src/player/NoCampaignScreen.tsx': '70640fc1c973d2213f7953a0ea246f7c7abade0644fca4270d2673f392be4b33',
  'src/player/Panels.tsx': 'bba9e8abe65488f1b808d8f72d82ae6748f24c6b46fc171c39e63e90a5ea34fe',
  'src/player/PartyPanel.tsx': '9c4b63f9e6ba27e80ebf165286639632838baa7006a2874a2ea889eea9475cbb',
  'src/player/PlayerPortrait.tsx': '4e7bb8e96c20ab8eaf5d1c736b340f2d163ee85689f415a09f0eff97e8ce67ca',
  'src/player/SaveReportModal.tsx': '2c0127cc74342f4eedaabbebbe383bf59ad6f4353a290df7ccfe013e7ded13ba',
  'src/player/SavesPanel.tsx': 'e4787e2455ea0d495963e3d9dba39b5bb217409b29dc5201514affede7440056',
  'src/player/SceneScreen.tsx': 'e5f0287a4cb6114e163768dc952cb12dad50224eb27bcbe6c28b6f357f646c56',
  'src/player/TradePanel.tsx': '78711391629df002a689e28b83ba4726eadf5fe279748a2ec7906a84e1125269',
  'src/player/adventureRuntime.ts': '5c001f946fd4ea08b4dc36962b8fda9cef260ee080fcd08699e3e37eb27204f9',
  'src/player/frames.tsx': '16cd9e6ef7e72035640a8745c01e4b0b04ba1fdd8541644cbd04f707ddbbb152',
  'src/player/tips.ts': '938264729feb89ca4e9f6c22174624ee1780340ba635d553b6617309e7db2aca',
  'src/shared/ArtView.tsx': '4f16e17cec3b9e7c28647921683601ea276648bcb1fcfb79ae237c49eb517913',
  'src/shared/CutscenePlayer.tsx': '2232f7edba0d11c0fa314dc9d2ef1890b2bb1f7091b495275328332a248560a0',
  'src/shared/ErrorBoundary.tsx': 'b0ae7c0423a8a246ef12dec63de4f62f26c516bb840469574b0400e27b0c4e73',
  'src/shared/SettingsPanel.tsx': '792d0d3874790507f596048fb90c058cf0872dafef7bffcc2f5d9a7b01dbbe2b',
  'src/shared/aiBaseline.ts': '6531cab8e7ecbde2a93fc77a877806e1db1f73ab143e77be241059a7d04a6c52',
  'src/shared/audio.ts': '162bdb38e6bf15d56f8c3bd8fa7bb17d86389bac46767010fd582def50302dd8',
  'src/shared/compat.ts': '53890bdcf8d7661acd84c1e7a702b2bd1a118e3840ea8cede36221fb3055070a',
  'src/shared/cutsceneTts.ts': '4038fa9ff390216fdecae009c3e0ed19d5393635384ac801c4b89ec8d0bfde0d',
  'src/shared/fingerprint.ts': '8fa071b7a2db4424a3eb4f8caccf33af2204afabf6b4167da964809e9ca01583',
  'src/shared/icons.tsx': '2687aa7d23ccd1d300f08dc64e9638e503c83ccf4bb4115d9c9df706ed2947ad',
  'src/shared/issueReport.ts': 'cf596089b336c68ea49f902b7a32f1e1e27c7462b40a48154532efffc6378a68',
  'src/shared/migrate.ts': '3b80656533dbb1e624208415fc5bcf3b970e3502c1458cb9fc505da80df838fb',
  'src/shared/modals.tsx': 'a3d56615b708a145244fb220e163b0aef1243440f5c097c2e8826211b2fb2003',
  'src/shared/music.ts': '07d482a3c428fa4c66c01ffbb8c7e22bf7ff3775f7787d1cdc4fb908e544f4ad',
  'src/shared/profiles.ts': '3f47a516f52fb30e20ccee56d228e8ed25eecf7d684250ad6c7d00d3b6a65bcd',
  'src/shared/ruleFiles.ts': 'e04980595fcbb686fbec0bed7cd45af975ad16e75a5f3cba2d5f189bed247e79',
  'src/shared/settings.ts': 'ba9ec3c22a95324fe21f10d64fabdfe0d6b40a6fbc9c8fa0fc1b8ff641339de7',
  'src/shared/skills.ts': 'cb90d16138b9ef3d540591b6878a4516aedacc058b2fce13c378fce3dfb500dd',
  'src/shared/speech.ts': '4c4da8cd70303e2550047cf6cfd92b7fa72e77d89df5a63881ece59a37228aa4',
  'src/shared/speechTiming.ts': 'b9cd302cec777d483c70c35329124c3f4a333daf2a73f74b5abf2cc790ee0520',
  'src/shared/synth.ts': '1c8e3ae7663c9db2658dd96cf2ddda5dd51d01077e033861747e01654d82a875',
  'src/shared/tauri.ts': 'e2c06df198a4b5fade2aa0d3a9d77dfe534e7d64965a9d803d0b73a3140e1470',
  'src/shared/theme.ts': '3c20aa1ea081a7f6d6ade7fd6a77dfc0400c55170721c93a4443dc02391d6a6b',
  'src/shared/tooltip.ts': 'a1be9c996e9c3926f40e8f02b2f1251a4d6be087565b9a38874ee94a7998aff9',
  'src/shared/types.ts': '6ec182603f6693daacdbf5e3b2d7ee5600b81db2362f143ad55caea206044d54',
  'src/shared/versions.ts': '5129fe967c82d21961da5ae334152a29b6faa6e5190c29bea0b5e6a0c352af6a',
  'src/shared/voiceAudio.ts': '53e40f12267e8849afd3704278867b1020eea508ad310c12bad736257931ff82',
}

interface SizeResult {
  path: string
  lines: number
  limit: number
  violation?: string
}

function countLines(contents: string): number {
  if (contents.length === 0) return 0
  const lines = contents.split(/\r\n|\r|\n/).length
  return lines - (/(?:\r\n|\r|\n)$/.test(contents) ? 1 : 0)
}

function limitFor(path: string): number {
  return path === ENGINE_PATH ? FACADE_LIMIT : MODULE_LIMIT
}

function evaluateSize(path: string, contents: string): SizeResult {
  const lines = countLines(contents)
  const limit = limitFor(path)
  return {
    path,
    lines,
    limit,
    violation: lines > limit ? `${path}: ${lines} lines exceeds limit=${limit}` : undefined,
  }
}

async function sourceFiles(dir: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(join(repoRoot, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name).replaceAll('\\', '/')
    if (entry.isDirectory()) result.push(...await sourceFiles(path))
    else if (entry.isFile() && sourceExtensions.test(path)) result.push(path)
  }
  return result
}

async function changedSourceModules(): Promise<string[]> {
  // Compare source bytes to the checked-in baseline, not git history or remote refs.
  // This is deterministic in full, depth-1, and archived checkouts.
  const paths = [...await sourceFiles('src'), ...await sourceFiles('packs')].sort()
  const changed: string[] = []
  for (const path of paths) {
    const digest = createHash('sha256').update(await readFile(join(repoRoot, path))).digest('hex')
    if (BASELINE_SOURCE_SHA256[path] !== digest) changed.push(path)
  }
  return changed
}

function assertFixture(name: string, path: string, lines: number, expectedRc: number): void {
  const result = evaluateSize(path, 'x\n'.repeat(lines))
  const actualRc = result.violation ? 1 : 0
  assert.equal(actualRc, expectedRc, `${name}: expected rc=${expectedRc}, got rc=${actualRc}; ${result.violation ?? `lines=${result.lines}, limit=${result.limit}`}`)
  if (expectedRc !== 0) {
    assert.ok(result.violation?.includes(String(lines)), `${name}: failure must include actual line count ${lines}`)
    assert.ok(result.violation?.includes(String(result.limit)), `${name}: failure must include limit ${result.limit}`)
  }
  console.log(`${name}: PASS — rc=${actualRc}, lines=${result.lines}, limit=${result.limit}`)
}

function verifyFixtures(): void {
  assertFixture('fixture (a) changed module 451 lines', 'src/core/fixture.ts', 451, 1)
  assertFixture('fixture (b) changed module 450 lines', 'src/core/fixture.ts', 450, 0)
  assertFixture('fixture (c) engine.ts 600 lines', ENGINE_PATH, 600, 0)
  assertFixture('fixture (d) engine.ts 601 lines', ENGINE_PATH, 601, 1)
}

async function readResult(path: string): Promise<SizeResult> {
  const contents = await readFile(join(repoRoot, path), 'utf8')
  return evaluateSize(path, contents)
}

async function main(): Promise<void> {
  verifyFixtures()

  const changedModules = await changedSourceModules()
  const checkedPaths = new Set(changedModules)
  // The engine facade is a global architecture invariant, not external debt.
  checkedPaths.add(ENGINE_PATH)

  const results: SizeResult[] = []
  for (const path of [...checkedPaths].sort()) results.push(await readResult(path))
  const debtResults: SizeResult[] = []
  for (const path of EXTERNAL_DEBT) debtResults.push(await readResult(path))

  console.log(`limit=${MODULE_LIMIT} facade=${FACADE_LIMIT}`)
  console.log(`baseline source modules=${Object.keys(BASELINE_SOURCE_SHA256).length}`)
  console.log(`changed source modules=${changedModules.length}`)
  for (const result of results) {
    console.log(`module ${result.path}: ${result.lines}/${result.limit} lines${changedModules.includes(result.path) ? ' (changed)' : ' (facade)'}`)
  }
  console.log(
    `external debt (non-blocking unless changed): ${debtResults.map((item) => `${item.path} ${item.lines}`).join('; ')}`,
  )

  const failures = results.filter((result) => result.violation)
  if (failures.length > 0) {
    for (const failure of failures) console.error(`✗ ${failure.violation}`)
    console.error(`check:module-size failed: ${failures.length} module(s) exceed their limit`)
    process.exitCode = 1
    return
  }
  console.log('check:module-size passed')
}

await main()

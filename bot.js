const mineflayer = require('mineflayer')
const mineflayerViewer = require('prismarine-viewer').mineflayer
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const Vec3 = require('vec3')

let serverIP = 'thisisabottest.aternos.me'
let port = '53858'
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_INTERVAL = 10000 // 10 seconds

function createBot() {
    const bot = mineflayer.createBot({
        host: serverIP,
        port: port,
        username: 'Bot' + Math.floor(Math.random() * 1000),
        auth: 'offline'
    })

    bot.loadPlugin(pathfinder)

    let spawnPoint = null
    let movementInterval = null

    bot.once('spawn', () => {
        const mcData = require('minecraft-data')(bot.version)
        const defaultMove = new Movements(bot, mcData)
        bot.pathfinder.setMovements(defaultMove)
        mineflayerViewer(bot, { port: 3007, firstPerson: false })
        console.log('Bot spawned. Live view on http://localhost:3007')
        let reconnectAttempts = 0
        startRandomMovements()
    })
    
    bot.on('end', (reason) => {
        console.log('Bot disconnected. Reason:', reason)
        handleReconnect(reason)
    });

    bot.on('error', (err) => {
        console.error('Bot encountered an error:', err)
        handleReconnect(err.message)
    })

    function handleReconnect(reason) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            console.log(`Attempting to rejoin... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
            setTimeout(createBot, RECONNECT_INTERVAL)
        } else {
            console.log('Max reconnection attempts reached. Please check your connection and server status.')
            console.log('Enter the server IP to try again, or press Ctrl+C to exit:')
            reconnectAttempts = 0 // Reset for next time
        }
    }

    

    bot.on('death', () => {
        const deathMessage = `The Bot was killed`
        console.log(deathMessage)
        bot.chat(deathMessage)
        console.log('Respawning...')
        bot.chat('/respawn')
    })

    bot.on('error', (err) => {
        console.error('Bot encountered an error:', err)
    })

    function displayCoordinates() {
        if (bot.entity) {
            const pos = bot.entity.position
            console.log(`Current position: X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`)
            console.log(`Yaw: ${bot.entity.yaw.toFixed(2)}, Pitch: ${bot.entity.pitch.toFixed(2)}`)
        } else {
            console.log('Bot position not available')
        }
    }

    function performHeadMovement() {
        const newYaw = (Math.random() - 0.5) * Math.PI * 2 // Random yaw between -π and π
        const newPitch = (Math.random() - 0.5) * Math.PI // Random pitch between -π/2 and π/2
        bot.look(newYaw, newPitch, true)
    }

    function findAccessibleBlocks(radius) {
        const accessibleBlocks = []
        const botPosition = bot.entity.position.floored()

        for (let x = -radius; x <= radius; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -radius; z <= radius; z++) {
                    const blockPos = botPosition.offset(x, y, z)
                    const block = bot.blockAt(blockPos)
                    const aboveBlock = bot.blockAt(blockPos.offset(0, 1, 0))
                    const bottomBlock = bot.blockAt(blockPos.offset(0, -1, 0))

                    if (block && aboveBlock && bottomBlock &&
                        block.name === "air" && aboveBlock.name === "air" && bottomBlock.name !== "air") {
                        accessibleBlocks.push(blockPos)
                    }
                }
            }
        }

        return accessibleBlocks
    }

    function performRandomMovement() {
        performHeadMovement()

        const accessibleBlocks = findAccessibleBlocks(3)
        if (accessibleBlocks.length > 0) {
            const randomBlock = accessibleBlocks[Math.floor(Math.random() * accessibleBlocks.length)]
            bot.pathfinder.setGoal(new goals.GoalBlock(randomBlock.x, randomBlock.y, randomBlock.z))
        }

        if (Math.random() < 0.2) {
            bot.setControlState('jump', true)
            setTimeout(() => {
                bot.setControlState('jump', false)
                displayCoordinates()
            }, 500)
        }
    }

    function startRandomMovements() {
        if (movementInterval) clearInterval(movementInterval)
        movementInterval = setInterval(performRandomMovement, 3000)
    }

    function stopRandomMovements() {
        if (movementInterval) {
            clearInterval(movementInterval)
            movementInterval = null
        }
    }

    async function navigateAndPlaceBed(x, y, z) {
        stopRandomMovements()

        const mcData = require('minecraft-data')(bot.version)
        const bedItem = bot.inventory.items().find(item => item.name.includes('bed'))

        if (!bedItem) {
            console.log('No bed in inventory')
            startRandomMovements()
            return
        }

        try {
            await bot.pathfinder.goto(new goals.GoalBlock(x, y, z))
            await bot.equip(bedItem, 'hand')
            const direction = bot.entity.yaw
            await bot.placeBlock(bot.blockAt(bot.entity.position.offset(0, -1, 0)), new Vec3(0, 1, 0))
            console.log('Bed placed successfully')
            displayCoordinates()
        } catch (err) {
            console.log('Error placing bed:', err)
        }

        startRandomMovements()
    }

    process.stdin.on('data', (input) => {
        const [command, ...args] = input.toString().trim().split(' ')
        if (command === 'setspawn') {
            const [x, y, z] = args.map(Number)
            spawnPoint = { x, y, z }
            console.log(`Spawn point set to ${x}, ${y}, ${z}`)
        } else if (command === 'placebed' && spawnPoint) {
            navigateAndPlaceBed(spawnPoint.x, spawnPoint.y, spawnPoint.z)
        } else if (command === 'connect') {
            serverIP = args[0]
            console.log(`Connecting to ${serverIP}...`)
            createBot()
        } else if (command === 'coords') {
            displayCoordinates()
        }
    })

    return bot
}

createBot()
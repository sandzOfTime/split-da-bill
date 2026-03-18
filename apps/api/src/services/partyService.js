const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const generatePartyCode = require("../utils/generatePartyCode")

const {
  NotFoundError,
  UnauthorizedError,
  BadRequestError
} = require("../errors/AppError")

async function createParty({ name, ownerId }) {
  return await prisma.$transaction(async (tx) => {

    logger.info({ msg: "Creating party", ownerId: ownerId })

    const partyIdentifier = generatePartyCode()

    logger.info({ msg: "Party Identifier generated", partyId: partyIdentifier })

    if (name == null) {
      logger.info({ msg: "No name given for party. Assigning party Identifier to name", partyId: partyIdentifier })
      name = `Party# ${partyIdentifier}`
    }

    const party = await tx.party.create({
      data: {
        name,
        partyIdentifier,
        partyOwnerId: ownerId,
        numOfMembers: 1,
        members: {
          create: {
            userId: ownerId
          }
        }
      },
      include: { members: true }
    })

    logger.info({ msg: "New Party succesfully generated", partyId: partyId })

    return party
  })
}

// 2️⃣ JOIN PARTY
async function joinPartyByIdentifier({ partyIdentifier, userId }) {
  return await prisma.$transaction(async (tx) => {

    logger.info({
      msg: "Joining party",
      partyIdentifier,
      userId
    })

    const party = await tx.party.findUnique({
      where: { partyIdentifier }
    })

    if (!party) {
      logger.warn({
        msg: "Party not found",
        partyIdentifier
      })
      throw new NotFoundError("Party not found")
    }

    const member = await tx.partyMember.create({
      data: {
        userId,
        partyId: party.id
      }
    })

    logger.info({
      msg: "Member added to party",
      memberId: member.id
    })

    await tx.party.update({
      where: { id: party.id },
      data: {
        numOfMembers: { increment: 1 }
      }
    })

    logger.info({
      msg: "Party member count updated",
      partyId: party.id
    })

    return member
  })
}

// 3️⃣ VIEW PARTY
async function viewParty({ partyIdentifier, requesterId }) {
  return await prisma.$transaction(async (tx) => {

    logger.info({
      msg: "Viewing party",
      partyIdentifier,
      requesterId
    })

    const party = await tx.party.findUnique({
      where: { partyIdentifier }
    })

    if (!party) {
      logger.warn({
        msg: "Party not found",
        partyIdentifier
      })
      throw new NotFoundError("Party not found")
    }

    if (party.partyOwnerId !== requesterId) {
      logger.warn({
        msg: "Unauthorized party access",
        requesterId,
        partyOwnerId: party.partyOwnerId
      })
      throw new UnauthorizedError("Only owner can view party")
    }

    const result = await tx.party.findUnique({
      where: { partyIdentifier },
      include: {
        members: {
          include: {
            user: true,
            menuItems: true
          }
        }
      }
    })

    logger.info({
      msg: "Party fetched successfully",
      partyId: party.id
    })

    return result
  })
}

// 4️⃣ DELETE PARTY
async function deleteParty({ partyIdentifier, requesterId }) {
  return await prisma.$transaction(async (tx) => {

    logger.info({
      msg: "Deleting party",
      partyIdentifier,
      requesterId
    })

    const party = await tx.party.findUnique({
      where: { partyIdentifier }
    })

    if (!party) {
      logger.warn({
        msg: "Party not found",
        partyIdentifier
      })
      throw new NotFoundError("Party not found")
    }

    if (party.partyOwnerId !== requesterId) {
      logger.warn({
        msg: "Unauthorized delete attempt",
        requesterId
      })
      throw new UnauthorizedError("Only owner can delete party")
    }

    const members = await tx.partyMember.findMany({
      where: { partyId: party.id }
    })

    const memberIds = members.map(m => m.id)

    logger.info({
      msg: "Deleting related menu items",
      count: memberIds.length
    })

    await tx.menuItem.deleteMany({
      where: {
        partyMemberId: { in: memberIds }
      }
    })

    await tx.partyMember.deleteMany({
      where: { partyId: party.id }
    })

    await tx.party.delete({
      where: { id: party.id }
    })

    logger.info({
      msg: "Party deleted successfully",
      partyId: party.id
    })

    return { success: true }
  })
}

// 5️⃣ GET MENU ITEMS
async function getMenuItems({ userId, partyIdentifier }) {
  return await prisma.$transaction(async (tx) => {

    logger.info({
      msg: "Fetching menu items",
      userId,
      partyIdentifier
    })

    const party = await tx.party.findUnique({
      where: { partyIdentifier }
    })

    if (!party) {
      logger.warn({
        msg: "Party not found",
        partyIdentifier
      })
      throw new NotFoundError("Party not found")
    }

    const member = await tx.partyMember.findFirst({
      where: {
        userId,
        partyId: party.id
      }
    })

    if (!member) {
      logger.warn({
        msg: "User not in party",
        userId,
        partyId: party.id
      })
      throw new BadRequestError("User is not part of this party")
    }

    const items = await tx.menuItem.findMany({
      where: {
        partyMemberId: member.id
      }
    })

    logger.info({
      msg: "Menu items retrieved",
      count: items.length,
      memberId: member.id
    })

    return items
  })
}

// 6️⃣ DELETE MENU ITEM + RECALCULATE TOTALS
async function deleteMenuItemAndRecalculateTotals({
  menuItemId,
  userId
}) {
  return await prisma.$transaction(async (tx) => {

    logger.info({
      msg: "Deleting menu item",
      menuItemId,
      userId
    })

    const item = await tx.menuItem.findUnique({
      where: { id: menuItemId }
    })

    if (!item) {
      logger.warn({
        msg: "Menu item not found",
        menuItemId
      })
      throw new NotFoundError("Menu item not found")
    }

    const member = await tx.partyMember.findUnique({
      where: { id: item.partyMemberId }
    })

    if (member.userId !== userId) {
      logger.warn({
        msg: "Unauthorized menu item deletion",
        userId,
        ownerId: member.userId
      })
      throw new UnauthorizedError()
    }

    await tx.menuItem.delete({
      where: { id: menuItemId }
    })

    logger.info({
      msg: "Menu item deleted",
      menuItemId
    })

    const items = await tx.menuItem.findMany({
      where: { partyMemberId: member.id }
    })

    const memberTotal = items.reduce((sum, i) => sum + i.price, 0)

    await tx.partyMember.update({
      where: { id: member.id },
      data: { totalPrice: memberTotal }
    })

    const members = await tx.partyMember.findMany({
      where: { partyId: member.partyId }
    })

    const partyTotal = members.reduce((sum, m) => sum + m.totalPrice, 0)

    await tx.party.update({
      where: { id: member.partyId },
      data: { totalPrice: partyTotal }
    })

    logger.info({
      msg: "Totals recalculated",
      memberId: member.id,
      partyId: member.partyId,
      memberTotal,
      partyTotal
    })

    return { success: true }
  })
}

module.exports = {
  createParty,
  joinPartyByIdentifier,
  viewParty,
  deleteParty,
  getMenuItems,
  deleteMenuItemAndRecalculateTotals
}
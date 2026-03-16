const prisma = require("../lib/prisma")
const generatePartyCode = require("../utils/generatePartyCode").default

async function createParty({ name, ownerId }) {

  const partyIdentifier = generatePartyCode()

  const party = await prisma.party.create({
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
    include: {
      members: true
    }
  })

  return party
}

async function joinPartyByIdentifier({ partyIdentifier, userId }) {

    const party = await prisma.party.findUnique({
      where: { partyIdentifier }
    })
  
    if (!party) {
      throw new Error("Party not found")
    }
  
    const member = await prisma.partyMember.create({
      data: {
        userId,
        partyId: party.id
      }
    })
  
    await prisma.party.update({
      where: { id: party.id },
      data: {
        numOfMembers: {
          increment: 1
        }
      }
    })
  
    return member
  }

  async function addMenuItemAndRecalculateTotals({
    partyMemberId,
    name,
    price
  }) {
  
    const item = await prisma.menuItem.create({
      data: {
        name,
        price,
        partyMemberId
      }
    })
  
    const items = await prisma.menuItem.findMany({
      where: { partyMemberId }
    })
  
    const memberTotal = items.reduce((sum, item) => sum + item.price, 0)
  
    const member = await prisma.partyMember.update({
      where: { id: partyMemberId },
      data: {
        totalPrice: memberTotal
      }
    })
  
    const partyMembers = await prisma.partyMember.findMany({
      where: { partyId: member.partyId }
    })
  
    const partyTotal = partyMembers.reduce(
      (sum, m) => sum + m.totalPrice,
      0
    )
  
    await prisma.party.update({
      where: { id: member.partyId },
      data: {
        totalPrice: partyTotal
      }
    })
  
    return item
  }
  
  module.exports = {
    createParty,
    joinPartyByIdentifier,
    addMenuItemAndRecalculateTotals
  }
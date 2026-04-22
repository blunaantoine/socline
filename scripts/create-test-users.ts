import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('Création des comptes de test...\n');

  try {
    // 1. Client test
    const client = await prisma.user.create({
      data: {
        phone: '90123456',
        name: 'Kofi Mensah',
        plateNumber: 'TG 1234 A',
        carColor: 'Noir',
        pin: '1234',
        role: 'CLIENT',
      },
    });
    console.log('✅ Client créé:');
    console.log('   📱 Téléphone: 90123456');
    console.log('   🔐 PIN: 1234');
    console.log('   👤 Nom: Kofi Mensah');
    console.log('   🚗 Plaque: TG 1234 A');
    console.log('   🎨 Couleur: Noir\n');

    // 2. Laveur test
    const washer = await prisma.user.create({
      data: {
        phone: '90234567',
        name: 'Yaw Adzimah',
        pin: '1234',
        role: 'WASHER',
      },
    });

    const washerProfile = await prisma.washer.create({
      data: {
        userId: washer.id,
        isAvailable: true,
        isVerified: true,
        rating: 4.8,
        totalRatings: 150,
        completedJobs: 120,
        latitude: 6.1725,
        longitude: 1.2314,
        address: 'Centre-ville, Lomé',
      },
    });
    console.log('✅ Laveur créé:');
    console.log('   📱 Téléphone: 90234567');
    console.log('   🔐 PIN: 1234');
    console.log('   👤 Nom: Yaw Adzimah');
    console.log('   ⭐ Note: 4.8/5 (120 travaux)\n');

    // 3. Admin test
    const admin = await prisma.user.create({
      data: {
        phone: '90999999',
        name: 'Admin WashGo',
        pin: '0000',
        role: 'ADMIN',
      },
    });
    console.log('✅ Admin créé:');
    console.log('   📱 Téléphone: 90999999');
    console.log('   🔐 PIN: 0000');
    console.log('   👤 Nom: Admin WashGo\n');

    // 4. Autre client test
    const client2 = await prisma.user.create({
      data: {
        phone: '90888888',
        name: 'Aména Kudjo',
        plateNumber: 'TG 5678 B',
        carColor: 'Blanc',
        pin: '5678',
        role: 'CLIENT',
      },
    });
    console.log('✅ Client 2 créé:');
    console.log('   📱 Téléphone: 90888888');
    console.log('   🔐 PIN: 5678');
    console.log('   👤 Nom: Aména Kudjo');
    console.log('   🚗 Plaque: TG 5678 B');
    console.log('   🎨 Couleur: Blanc\n');

    console.log('🎉 Tous les comptes de test ont été créés avec succès!');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('⚠️  Les comptes existent déjà. Mise à jour...\n');
      
      // Update existing users
      await prisma.user.update({
        where: { phone: '90123456' },
        data: {
          name: 'Kofi Mensah',
          plateNumber: 'TG 1234 A',
          carColor: 'Noir',
          pin: '1234',
        },
      });
      
      await prisma.user.update({
        where: { phone: '90234567' },
        data: {
          name: 'Yaw Adzimah',
          pin: '1234',
        },
      });
      
      await prisma.user.update({
        where: { phone: '90999999' },
        data: {
          name: 'Admin WashGo',
          pin: '0000',
        },
      });
      
      await prisma.user.update({
        where: { phone: '90888888' },
        data: {
          name: 'Aména Kudjo',
          plateNumber: 'TG 5678 B',
          carColor: 'Blanc',
          pin: '5678',
        },
      });
      
      console.log('✅ Comptes mis à jour avec succès!\n');
    } else {
      throw error;
    }
  }
}

createTestUsers()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

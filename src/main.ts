import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);

  const caslFactory = app.get(CaslAbilityFactory);

  const adminAbility = caslFactory.createForUser({ userId: 1, role: 'ADMIN' });
  console.log('Admin', adminAbility.can('manage', 'all'));

  const employeeAbility = caslFactory.createForUser({
    userId: 5,
    role: 'EMPLOYEE',
  });
  console.log(
    'Employee Attendance:',
    employeeAbility.can('read', 'Attendance'),
  );
  console.log('Employee all:', employeeAbility.can('manage', 'all'));
}
bootstrap();

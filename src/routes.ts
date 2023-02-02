import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./lib/prisma";
import dayjs from "dayjs";

/**
 * Precisa ser assíncrona, porque senão o fastify vai ficar esperando
 * retornar alguma coisa e nunca vai retornar
 */
export async function appRoutes(app: FastifyInstance) {
  /**
   * Rota para cadastro do hábito, recebe dois parâmetros
   * título e os dias da semana
   */
  app.post('/habits', async (request) => {
    const createHabitBody  = z.object({
      title: z.string(),
      /**
       * [0,1,2,3,4,5,6]
       * Seg, Ter, Qua, Qui, Sex, Sab, Dom
       */
      weekDays: z.array(
        z.number().min(0).max(6)
      )
    });
    
    const { title, weekDays } = createHabitBody.parse(request.body);

    //Pega a data atual e zera o tempo do dia 2023-01-01 00:00:00
    const today = dayjs().startOf('day').toDate();

    await prisma.habit.create({
      data: {
        title,
        create_at: today,
        weekDays: {
          create: weekDays.map(weekDay => {
            return {
              week_day: weekDay
            }
          })
        }
      }
    })
  });

  /**
   * Todos os hábitos possíveis do dia e todos que já foram completados
   * /day?date=2023-01-13
   */
  app.get('/day', async (request) => {
    const getDayParams = z.object({
      //converte a string em data
      date: z.coerce.date()
    });

    const { date } = getDayParams.parse(request.query);
    const parseData = dayjs(date).startOf('day');
    //Retorna o dia atual da semana em número
    const weekDay = parseData.get('day');

    const possibleHabits = await prisma.habit.findMany({
      where: {
        create_at: {
          lte: date
        },
        weekDays: {
          some: {
            week_day: weekDay
          }
        }
      }
    });

    //Hábitos que o usuário já completou nesse dia
    const day = await prisma.day.findUnique({
      where: {
        date: parseData.toDate()
      },
      include: {
        dayHabits: true
      }
    });

    const completedHabits = day?.dayHabits.map(dayHabit => {
      return dayHabit.habit_id;
    });

    return {
      possibleHabits,
      completedHabits
    }
  })
}


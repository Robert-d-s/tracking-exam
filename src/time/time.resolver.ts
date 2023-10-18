import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TimeService } from './time.service';
import { Time } from './time.model';
import { TimeInputCreate, TimeInputUpdate } from './time.input';

@Resolver(() => Time)
export class TimeResolver {
  constructor(private readonly timeService: TimeService) {}

  @Query(() => [Time])
  async times(@Args('projectId') projectId: string): Promise<Time[]> {
    return this.timeService.all(projectId);
  }

  @Mutation(() => Time)
  async createTime(
    @Args('timeInputCreate') timeInputCreate: TimeInputCreate,
  ): Promise<Time> {
    const { startTime, projectId, userId, endTime, rateId } = timeInputCreate;

    // Check for duplicate entries
    const duplicate = await this.timeService.isDuplicate(
      startTime,
      endTime,
      userId,
      projectId,
      rateId,
    );

    if (duplicate) {
      // If a duplicate entry is found, throw an error
      throw new Error('Duplicate time entry not allowed');
    }

    return this.timeService.create(
      startTime,
      projectId,
      userId,
      rateId,
      endTime,
    );
  }

  @Mutation(() => Time)
  async updateTime(
    @Args('timeInputUpdate') timeInputUpdate: TimeInputUpdate,
  ): Promise<Time> {
    const { id, startTime, projectId, userId, endTime, rateId } =
      timeInputUpdate;
    return this.timeService.update(
      id,
      startTime,
      projectId,
      userId,
      rateId,
      endTime,
    );
  }

  @Query(() => Number)
  async getTotalTimeSpent(
    @Args('userId') userId: number,
    @Args('projectId') projectId: string,
    @Args('date') date: string,
  ): Promise<number> {
    const parsedDate = new Date(date); // Convert the date string to a Date object
    return this.timeService.getTotalTimeSpent(userId, projectId, parsedDate);
  }

  @Mutation(() => Time)
  async deleteTime(@Args('id') id: number): Promise<Time> {
    return this.timeService.remove(id);
  }
}

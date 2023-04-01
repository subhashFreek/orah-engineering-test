import { NextFunction, Request, Response } from "express"
import { getRepository, getManager } from "typeorm"
import { Group } from "../entity/group.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { CreateGroupInput, UpdateGroupInput, UpdateGroupMetaInput } from "../interface/group.interface"
import { CreateGroupStudentInput } from "../interface/group-student.interface"

export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private manager = getManager()

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1:

    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:

    // Add a Group
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
    }
    const group = new Group()
    group.prepareToCreate(createGroupInput)

    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:

    // Update a Group
    const { body: params } = request

    this.groupRepository.findOne(params.id).then((group) => {
      const updateGroupInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
      }
      group.prepareToUpdate(updateGroupInput)

      return this.groupRepository.save(group)
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:

    // Delete a Group
    let groupToRemove = await this.groupRepository.findOne(request.params.id)
    await this.groupRepository.remove(groupToRemove)
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1:

    // Return the list of Students that are in a Group
    const groupId: string = request.query.id
    return await this.manager.query(
      `SELECT s.id as id, s.first_name, s.last_name, s.photo_url FROM group_student as gs join student as s on gs.student_id = s.id where gs.group_id = ${groupId}`
    )
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    try {
      // Task 2:

      // 1. Clear out the groups (delete all the students from the groups)
      await this.manager.query(`DELETE FROM "group_student";`)

      // 2. For each group, query the student rolls to see which students match the filter for the group
      let groupList: Array<Group> = await this.groupRepository.find()
      for (let i = 0; i < groupList.length; i++) {
        let roleList: Array<string> = groupList[i].roll_states.split(",")

        let weakDate = new Date()
        weakDate.setDate(weakDate.getDate() - 7 * groupList[i].number_of_weeks)

        // create status for query
        let statesString = roleList.toString()
        statesString = statesString.replace(/,/g, '","')
        statesString = '"' + statesString + '"'

        // query
        let studentList = await this.manager.query(
          `SELECT count(*) as incident_count, s.id FROM student_roll_state as srs join student as s on srs.student_id = s.id join roll as r on srs.roll_id = r.id where srs.state in (${statesString}) and r.completed_at > ${weakDate.getTime()} GROUP BY s.id having COUNT(*) ${
            groupList[i].ltmt
          } ${groupList[i].incidents}`
        )

        // 3. Add the list of students that match the filter to the group
        for (let j = 0; j < studentList.length; j++) {
          const createGroupStudentInput: CreateGroupStudentInput = {
            student_id: studentList[j].id,
            group_id: groupList[i].id,
            incident_count: studentList[j].incident_count,
          }

          // create groupStudent
          const groupStudent = new GroupStudent()
          groupStudent.prepareToCreate(createGroupStudentInput)
          await this.groupStudentRepository.save(groupStudent)
        }

        // update group
        await this.manager.query(`UPDATE "group" set student_count=${studentList.length},run_at=${new Date().getTime()} where id=${groupList[i].id}`)
      }
      return {
        status: 0,
        message: "Filter successfully",
      }
    } catch (err) {
      console.log("ERROR: ", err)
      response.status = 500
      return {
        status: 1,
        message: "Internal Server Error",
      }
    }
  }
}

import type { MissionSummaryResponse } from '@/types/daily-missions';

export function missionsSummaryFixture(): MissionSummaryResponse {
  return {
    days: 2,
    from_day: '2026-10-10',
    catalog: [
      { id: 'lesson_complete_1', kind: 'lesson', target: 1, requires_mic: false },
      { id: 'game_finish_1', kind: 'game', target: 1, requires_mic: false },
      { id: 'review_cards_10', kind: 'review', target: 10, requires_mic: false },
    ],
    items: [
      {
        day: '2026-10-11', learners_assigned: 3, missions_assigned: 9, claims: 5, distinct_claimers: 3, all_claimed: 1, bonus: 10,
        missions: [
          { mission_id: 'lesson_complete_1', assigned: 3, claims: 3, bonus: 6 },
          { mission_id: 'game_finish_1', assigned: 3, claims: 2, bonus: 4 },
          { mission_id: 'review_cards_10', assigned: 3, claims: 0, bonus: 0 },
        ],
      },
      {
        day: '2026-10-10', learners_assigned: 2, missions_assigned: 6, claims: 2, distinct_claimers: 2, all_claimed: 0, bonus: 0,
        missions: [
          { mission_id: 'lesson_complete_1', assigned: 2, claims: 1, bonus: 0 },
          { mission_id: 'old_mission', assigned: 2, claims: 1, bonus: 0 },
          { mission_id: 'game_finish_1', assigned: 2, claims: 0, bonus: 0 },
        ],
      },
    ],
  };
}

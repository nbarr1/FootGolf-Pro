/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { COURSES } from '../game/courses';
import { CourseData } from '../types';

interface CourseSelectModalProps {
  currentCourseId: string;
  onSelectCourse: (course: CourseData) => void;
  onClose: () => void;
}

export const CourseSelectModal: React.FC<CourseSelectModalProps> = ({
  currentCourseId,
  onSelectCourse,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-2xl text-left shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-black text-white tracking-wide uppercase">
              FootGolf World Tour Courses
            </h2>
            <p className="text-xs text-slate-400">
              Select an international venue with unique weather, terrain, and hazards.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          {COURSES.map((course) => {
            const isSelected = course.id === currentCourseId;
            const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);
            const totalMeters = course.holes.reduce((sum, h) => sum + h.lengthMeters, 0);

            return (
              <div
                key={course.id}
                onClick={() => onSelectCourse(course)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-white">{course.name}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        course.difficulty === 'Beginner'
                          ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                          : course.difficulty === 'Intermediate'
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          : course.difficulty === 'Pro Tour'
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                          : 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                      }`}
                    >
                      {course.difficulty}
                    </span>
                  </div>
                  <div className="text-xs text-emerald-400 font-medium mb-1.5">
                    📍 {course.location}
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {course.description}
                  </p>

                  <div className="flex gap-4 mt-2.5 text-[11px] text-slate-400 font-mono">
                    <span>⛳ {course.holes.length} Holes</span>
                    <span>Par: {totalPar}</span>
                    <span>Distance: {totalMeters}m</span>
                    <span className="capitalize">Theme: {course.theme.replace('_', ' ')}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCourse(course);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Tee Off'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

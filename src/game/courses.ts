/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CourseData } from '../types';

export const COURSES: CourseData[] = [
  {
    id: 'pine_valley',
    name: 'Pine Valley Links',
    location: 'Pacific Northwest, USA',
    description: 'Championship parkland course framed by majestic evergreen pines, rolling emerald hills, and challenging bunker complexes.',
    difficulty: 'Beginner',
    theme: 'parkland',
    skyColor: '#6da5d8',
    fogColor: '#96badc',
    grassColor: '#2e7d32',
    roughColor: '#1b4d24',
    fairwayColor: '#43a047',
    greenColor: '#4caf50',
    sandColor: '#e0c98b',
    waterColor: '#1e6f9f',
    holes: [
      {
        id: 1,
        number: 1,
        par: 4,
        lengthMeters: 175,
        teePosition: { x: 0, y: 0.8, z: -10 },
        pinPosition: { x: 12, y: 1.2, z: 165 },
        fairways: [
          { x: 0, z: 45, rx: 16, rz: 40 },
          { x: 8, z: 110, rx: 18, rz: 45 },
          { x: 12, z: 155, rx: 14, rz: 22 },
        ],
        greens: [
          { x: 12, z: 165, radius: 11 },
        ],
        bunkers: [
          { x: -14, z: 95, rx: 6, rz: 10 },
          { x: 22, z: 155, rx: 5, rz: 8 },
        ],
        waters: [
          { x: -28, z: 65, rx: 12, rz: 24 },
        ],
        trees: [
          { x: -22, z: 20, scale: 1.2, type: 'pine' },
          { x: -26, z: 45, scale: 1.4, type: 'pine' },
          { x: -24, z: 120, scale: 1.3, type: 'pine' },
          { x: 25, z: 30, scale: 1.1, type: 'pine' },
          { x: 28, z: 75, scale: 1.5, type: 'pine' },
          { x: 26, z: 130, scale: 1.3, type: 'pine' },
          { x: -12, z: 180, scale: 1.2, type: 'pine' },
          { x: 28, z: 175, scale: 1.4, type: 'pine' },
        ],
        rocks: [
          { x: 20, z: 50, scale: 1.0 },
          { x: -16, z: 140, scale: 1.3 },
        ],
        hills: [
          { x: 15, z: 60, radius: 25, height: 2.2 },
          { x: -15, z: 130, radius: 28, height: 1.8 },
        ],
        defaultAimAngle: 0.08,
      },
      {
        id: 2,
        number: 2,
        par: 3,
        lengthMeters: 118,
        teePosition: { x: 0, y: 3.5, z: 0 },
        pinPosition: { x: -6, y: 0.5, z: 115 },
        fairways: [
          { x: -2, z: 55, rx: 14, rz: 45 },
        ],
        greens: [
          { x: -6, z: 115, radius: 13 },
        ],
        bunkers: [
          { x: -16, z: 112, rx: 5, rz: 7 },
          { x: 8, z: 118, rx: 6, rz: 8 },
        ],
        waters: [
          { x: 0, z: 80, rx: 16, rz: 14 },
        ],
        trees: [
          { x: -24, z: 30, scale: 1.4, type: 'pine' },
          { x: 24, z: 35, scale: 1.2, type: 'pine' },
          { x: -25, z: 95, scale: 1.5, type: 'pine' },
          { x: 25, z: 100, scale: 1.3, type: 'pine' },
          { x: -18, z: 135, scale: 1.1, type: 'pine' },
        ],
        rocks: [
          { x: -12, z: 75, scale: 1.2 },
          { x: 14, z: 85, scale: 1.0 },
        ],
        hills: [
          { x: 0, z: 0, radius: 18, height: 3.2 },
          { x: 0, z: 80, radius: 22, height: -1.2 },
        ],
        defaultAimAngle: -0.05,
      },
      {
        id: 3,
        number: 3,
        par: 5,
        lengthMeters: 245,
        teePosition: { x: 0, y: 1.0, z: 0 },
        pinPosition: { x: 25, y: 2.0, z: 240 },
        fairways: [
          { x: 0, z: 60, rx: 18, rz: 45 },
          { x: 10, z: 135, rx: 20, rz: 50 },
          { x: 22, z: 215, rx: 16, rz: 40 },
        ],
        greens: [
          { x: 25, z: 240, radius: 12 },
        ],
        bunkers: [
          { x: -12, z: 85, rx: 7, rz: 12 },
          { x: 24, z: 155, rx: 6, rz: 10 },
          { x: 16, z: 235, rx: 5, rz: 7 },
        ],
        waters: [
          { x: -22, z: 170, rx: 14, rz: 32 },
        ],
        trees: [
          { x: -22, z: 40, scale: 1.3, type: 'pine' },
          { x: 22, z: 40, scale: 1.1, type: 'pine' },
          { x: 30, z: 110, scale: 1.4, type: 'pine' },
          { x: -15, z: 120, scale: 1.5, type: 'pine' },
          { x: 36, z: 200, scale: 1.3, type: 'pine' },
          { x: 12, z: 260, scale: 1.4, type: 'pine' },
        ],
        rocks: [
          { x: 18, z: 90, scale: 1.4 },
          { x: 32, z: 230, scale: 1.1 },
        ],
        hills: [
          { x: -10, z: 90, radius: 30, height: 2.5 },
          { x: 20, z: 180, radius: 25, height: 1.8 },
          { x: 25, z: 240, radius: 20, height: 1.5 },
        ],
        defaultAimAngle: 0.1,
      },
    ],
  },
  {
    id: 'sunset_dunes',
    name: 'Sunset Dunes & Oasis',
    location: 'Algarve Coast, Portugal',
    description: 'Golden sandy wastes, undulating coastal wind sweeps, and emerald oasis greens surrounded by tropical palms.',
    difficulty: 'Intermediate',
    theme: 'desert',
    skyColor: '#e08f52',
    fogColor: '#d69e72',
    grassColor: '#688d44',
    roughColor: '#9c814b',
    fairwayColor: '#5c8a38',
    greenColor: '#4f9435',
    sandColor: '#e8c07d',
    waterColor: '#1d8aa8',
    holes: [
      {
        id: 1,
        number: 1,
        par: 4,
        lengthMeters: 165,
        teePosition: { x: 0, y: 1.5, z: 0 },
        pinPosition: { x: -15, y: 0.8, z: 160 },
        fairways: [
          { x: 2, z: 50, rx: 17, rz: 42 },
          { x: -8, z: 115, rx: 16, rz: 44 },
          { x: -15, z: 155, rx: 13, rz: 20 },
        ],
        greens: [
          { x: -15, z: 160, radius: 11 },
        ],
        bunkers: [
          { x: 15, z: 65, rx: 8, rz: 14 },
          { x: -22, z: 110, rx: 7, rz: 12 },
          { x: -4, z: 155, rx: 6, rz: 8 },
        ],
        waters: [
          { x: 22, z: 130, rx: 14, rz: 26 },
        ],
        trees: [
          { x: -20, z: 35, scale: 1.3, type: 'palm' },
          { x: 20, z: 30, scale: 1.2, type: 'palm' },
          { x: -24, z: 85, scale: 1.4, type: 'palm' },
          { x: 28, z: 105, scale: 1.5, type: 'palm' },
          { x: -26, z: 150, scale: 1.3, type: 'palm' },
          { x: -6, z: 178, scale: 1.4, type: 'palm' },
        ],
        rocks: [
          { x: 14, z: 45, scale: 1.5 },
          { x: -18, z: 130, scale: 1.2 },
        ],
        hills: [
          { x: -15, z: 50, radius: 24, height: 2.8 },
          { x: 15, z: 110, radius: 26, height: 3.2 },
        ],
        defaultAimAngle: -0.09,
      },
      {
        id: 2,
        number: 2,
        par: 3,
        lengthMeters: 130,
        teePosition: { x: 0, y: 2.2, z: 0 },
        pinPosition: { x: 18, y: 1.0, z: 125 },
        fairways: [
          { x: 8, z: 65, rx: 15, rz: 50 },
        ],
        greens: [
          { x: 18, z: 125, radius: 12 },
        ],
        bunkers: [
          { x: 8, z: 118, rx: 6, rz: 10 },
          { x: 26, z: 125, rx: 5, rz: 8 },
          { x: 12, z: 75, rx: 8, rz: 12 },
        ],
        waters: [
          { x: -12, z: 85, rx: 16, rz: 22 },
        ],
        trees: [
          { x: -22, z: 45, scale: 1.4, type: 'palm' },
          { x: 22, z: 40, scale: 1.2, type: 'palm' },
          { x: -18, z: 115, scale: 1.3, type: 'palm' },
          { x: 28, z: 140, scale: 1.5, type: 'palm' },
        ],
        rocks: [
          { x: 4, z: 95, scale: 1.6 },
          { x: 24, z: 105, scale: 1.2 },
        ],
        hills: [
          { x: 20, z: 60, radius: 22, height: 2.4 },
        ],
        defaultAimAngle: 0.14,
      },
      {
        id: 3,
        number: 3,
        par: 5,
        lengthMeters: 242,
        teePosition: { x: 0, y: 1.8, z: 0 },
        pinPosition: { x: 22, y: 1.2, z: 238 },
        fairways: [
          { x: 2, z: 60, rx: 18, rz: 48 },
          { x: 12, z: 135, rx: 20, rz: 50 },
          { x: 20, z: 215, rx: 16, rz: 42 },
        ],
        greens: [
          { x: 22, z: 238, radius: 12 },
        ],
        bunkers: [
          { x: -14, z: 75, rx: 8, rz: 14 },
          { x: 24, z: 145, rx: 7, rz: 12 },
          { x: 12, z: 232, rx: 6, rz: 8 },
        ],
        waters: [
          { x: -18, z: 155, rx: 16, rz: 32 },
        ],
        trees: [
          { x: -22, z: 40, scale: 1.3, type: 'palm' },
          { x: 22, z: 45, scale: 1.2, type: 'palm' },
          { x: 30, z: 110, scale: 1.5, type: 'palm' },
          { x: -12, z: 120, scale: 1.4, type: 'palm' },
          { x: 34, z: 195, scale: 1.3, type: 'palm' },
          { x: 14, z: 255, scale: 1.5, type: 'palm' },
        ],
        rocks: [
          { x: 16, z: 85, scale: 1.5 },
          { x: 30, z: 225, scale: 1.2 },
        ],
        hills: [
          { x: -12, z: 80, radius: 28, height: 2.8 },
          { x: 22, z: 175, radius: 26, height: 2.2 },
        ],
        defaultAimAngle: 0.09,
      },
    ],
  },
  {
    id: 'alpine_highlands',
    name: 'Alpine Highlands Club',
    location: 'Tyrol, Austrian Alps',
    description: 'Dramatic vertical drops, mountain breezes, crystal alpine brooks, and undulating precision greens with panoramic peaks.',
    difficulty: 'Pro Tour',
    theme: 'alpine',
    skyColor: '#5c97d4',
    fogColor: '#88aed8',
    grassColor: '#2b6e3b',
    roughColor: '#174723',
    fairwayColor: '#3d8c4e',
    greenColor: '#43a047',
    sandColor: '#d9ccb4',
    waterColor: '#177699',
    holes: [
      {
        id: 1,
        number: 1,
        par: 4,
        lengthMeters: 190,
        teePosition: { x: 0, y: 5.0, z: 0 },
        pinPosition: { x: 10, y: 1.0, z: 185 },
        fairways: [
          { x: 0, z: 60, rx: 18, rz: 48 },
          { x: 8, z: 135, rx: 16, rz: 45 },
          { x: 10, z: 175, rx: 14, rz: 22 },
        ],
        greens: [
          { x: 10, z: 185, radius: 12 },
        ],
        bunkers: [
          { x: -12, z: 125, rx: 6, rz: 9 },
          { x: 18, z: 180, rx: 5, rz: 7 },
        ],
        waters: [
          { x: -22, z: 80, rx: 10, rz: 35 },
          { x: 2, z: 155, rx: 8, rz: 14 },
        ],
        trees: [
          { x: -25, z: 35, scale: 1.5, type: 'pine' },
          { x: 25, z: 35, scale: 1.4, type: 'pine' },
          { x: -26, z: 100, scale: 1.6, type: 'pine' },
          { x: 26, z: 110, scale: 1.3, type: 'pine' },
          { x: 24, z: 195, scale: 1.4, type: 'pine' },
        ],
        rocks: [
          { x: 18, z: 70, scale: 1.8 },
          { x: -16, z: 160, scale: 2.0 },
        ],
        hills: [
          { x: 0, z: 0, radius: 24, height: 5.0 },
          { x: 20, z: 100, radius: 30, height: 3.5 },
        ],
        defaultAimAngle: 0.05,
      },
      {
        id: 2,
        number: 2,
        par: 5,
        lengthMeters: 260,
        teePosition: { x: 0, y: 2.0, z: 0 },
        pinPosition: { x: -20, y: 3.2, z: 255 },
        fairways: [
          { x: 0, z: 65, rx: 19, rz: 50 },
          { x: -10, z: 145, rx: 18, rz: 50 },
          { x: -18, z: 225, rx: 16, rz: 42 },
        ],
        greens: [
          { x: -20, z: 255, radius: 13 },
        ],
        bunkers: [
          { x: 14, z: 90, rx: 7, rz: 12 },
          { x: -25, z: 175, rx: 6, rz: 10 },
          { x: -12, z: 250, rx: 5, rz: 8 },
        ],
        waters: [
          { x: 18, z: 165, rx: 15, rz: 35 },
        ],
        trees: [
          { x: -25, z: 50, scale: 1.5, type: 'pine' },
          { x: 25, z: 50, scale: 1.3, type: 'pine' },
          { x: 30, z: 130, scale: 1.6, type: 'pine' },
          { x: -30, z: 130, scale: 1.4, type: 'pine' },
          { x: -32, z: 240, scale: 1.5, type: 'pine' },
        ],
        rocks: [
          { x: -15, z: 95, scale: 1.6 },
          { x: 12, z: 215, scale: 1.7 },
        ],
        hills: [
          { x: 15, z: 80, radius: 30, height: 3.0 },
          { x: -20, z: 255, radius: 25, height: 3.2 },
        ],
        defaultAimAngle: -0.08,
      },
      {
        id: 3,
        number: 3,
        par: 3,
        lengthMeters: 138,
        teePosition: { x: 0, y: 5.8, z: 0 },
        pinPosition: { x: 14, y: 1.2, z: 132 },
        fairways: [
          { x: 6, z: 70, rx: 16, rz: 48 },
        ],
        greens: [
          { x: 14, z: 132, radius: 12 },
        ],
        bunkers: [
          { x: 4, z: 125, rx: 6, rz: 8 },
          { x: 22, z: 132, rx: 5, rz: 8 },
        ],
        waters: [
          { x: 0, z: 85, rx: 18, rz: 16 },
        ],
        trees: [
          { x: -24, z: 35, scale: 1.5, type: 'pine' },
          { x: 24, z: 35, scale: 1.3, type: 'pine' },
          { x: -26, z: 105, scale: 1.6, type: 'pine' },
          { x: 26, z: 115, scale: 1.4, type: 'pine' },
          { x: 0, z: 155, scale: 1.5, type: 'pine' },
        ],
        rocks: [
          { x: -14, z: 80, scale: 1.8 },
          { x: 18, z: 90, scale: 1.5 },
          { x: 20, z: 140, scale: 1.4 },
        ],
        hills: [
          { x: 0, z: 0, radius: 20, height: 5.8 },
          { x: 0, z: 85, radius: 24, height: -1.5 },
          { x: 14, z: 132, radius: 20, height: 1.2 },
        ],
        defaultAimAngle: 0.1,
      },
    ],
  },
  {
    id: 'sakura_imperial',
    name: 'Sakura Imperial Links',
    location: 'Kyoto Foothills, Japan',
    description: 'Serene Japanese championship gardens lined with weeping sakura cherry blossoms, moss fairways, arched stone features, and tranquil koi waters.',
    difficulty: 'Championship',
    theme: 'japanese_garden',
    skyColor: '#7895b2',
    fogColor: '#a1b5cc',
    grassColor: '#2d6a4f',
    roughColor: '#1b4332',
    fairwayColor: '#40916c',
    greenColor: '#52b788',
    sandColor: '#f4e9cd',
    waterColor: '#0077b6',
    holes: [
      {
        id: 1,
        number: 1,
        par: 4,
        lengthMeters: 172,
        teePosition: { x: 0, y: 1.0, z: 0 },
        pinPosition: { x: -12, y: 0.8, z: 168 },
        fairways: [
          { x: 0, z: 50, rx: 16, rz: 42 },
          { x: -6, z: 115, rx: 17, rz: 45 },
          { x: -12, z: 160, rx: 14, rz: 22 },
        ],
        greens: [
          { x: -12, z: 168, radius: 11 },
        ],
        bunkers: [
          { x: 14, z: 80, rx: 6, rz: 10 },
          { x: -20, z: 125, rx: 5, rz: 9 },
          { x: -2, z: 165, rx: 5, rz: 7 },
        ],
        waters: [
          { x: 20, z: 110, rx: 14, rz: 28 },
        ],
        trees: [
          { x: -22, z: 30, scale: 1.3, type: 'sakura' },
          { x: 22, z: 35, scale: 1.2, type: 'sakura' },
          { x: -24, z: 85, scale: 1.4, type: 'sakura' },
          { x: 28, z: 130, scale: 1.5, type: 'sakura' },
          { x: -22, z: 155, scale: 1.3, type: 'sakura' },
          { x: 6, z: 185, scale: 1.4, type: 'sakura' },
        ],
        rocks: [
          { x: 12, z: 55, scale: 1.3 },
          { x: -16, z: 140, scale: 1.1 },
        ],
        hills: [
          { x: -10, z: 65, radius: 26, height: 2.2 },
          { x: 15, z: 130, radius: 28, height: 2.0 },
        ],
        defaultAimAngle: -0.07,
      },
      {
        id: 2,
        number: 2,
        par: 3,
        lengthMeters: 125,
        teePosition: { x: 0, y: 2.5, z: 0 },
        pinPosition: { x: 10, y: 0.6, z: 122 },
        fairways: [
          { x: 5, z: 60, rx: 15, rz: 48 },
        ],
        greens: [
          { x: 10, z: 122, radius: 12 },
        ],
        bunkers: [
          { x: 0, z: 115, rx: 6, rz: 8 },
          { x: 20, z: 122, rx: 5, rz: 8 },
        ],
        waters: [
          { x: -10, z: 75, rx: 16, rz: 22 },
        ],
        trees: [
          { x: -22, z: 40, scale: 1.3, type: 'sakura' },
          { x: 22, z: 40, scale: 1.2, type: 'sakura' },
          { x: -18, z: 105, scale: 1.4, type: 'sakura' },
          { x: 25, z: 135, scale: 1.5, type: 'sakura' },
        ],
        rocks: [
          { x: 6, z: 85, scale: 1.4 },
          { x: 18, z: 105, scale: 1.2 },
        ],
        hills: [
          { x: 0, z: 0, radius: 18, height: 2.5 },
          { x: 10, z: 122, radius: 16, height: 0.6 },
        ],
        defaultAimAngle: 0.08,
      },
      {
        id: 3,
        number: 3,
        par: 5,
        lengthMeters: 252,
        teePosition: { x: 0, y: 1.5, z: 0 },
        pinPosition: { x: 24, y: 1.8, z: 248 },
        fairways: [
          { x: 0, z: 60, rx: 18, rz: 48 },
          { x: 10, z: 140, rx: 20, rz: 52 },
          { x: 20, z: 220, rx: 17, rz: 42 },
        ],
        greens: [
          { x: 24, z: 248, radius: 13 },
        ],
        bunkers: [
          { x: -14, z: 85, rx: 7, rz: 12 },
          { x: 25, z: 160, rx: 6, rz: 11 },
          { x: 14, z: 242, rx: 5, rz: 8 },
        ],
        waters: [
          { x: -20, z: 165, rx: 15, rz: 35 },
        ],
        trees: [
          { x: -22, z: 45, scale: 1.4, type: 'sakura' },
          { x: 22, z: 45, scale: 1.2, type: 'sakura' },
          { x: 30, z: 115, scale: 1.5, type: 'sakura' },
          { x: -26, z: 125, scale: 1.4, type: 'sakura' },
          { x: 36, z: 205, scale: 1.3, type: 'sakura' },
          { x: 14, z: 265, scale: 1.5, type: 'sakura' },
        ],
        rocks: [
          { x: 18, z: 95, scale: 1.5 },
          { x: 32, z: 235, scale: 1.2 },
        ],
        hills: [
          { x: -12, z: 85, radius: 28, height: 2.6 },
          { x: 22, z: 185, radius: 26, height: 2.4 },
          { x: 24, z: 248, radius: 20, height: 1.8 },
        ],
        defaultAimAngle: 0.1,
      },
    ],
  },
];

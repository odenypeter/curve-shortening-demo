// Copyright (c) 2014-2018 Anthony Carapetis
// This software is licensed under the MIT license.
// See COPYING for more details.

import { LocalFunction } from './CircularList';
import { Point, add, subtract, scale, squaredLength, equals, 
    Curve, ScalarFunction } from './geometry';

// Forward Euler approximation to CSF with tangential reparametrization
export function reparametrizedCSF(dt : number) : LocalFunction<Point, Point>{
    return (point, index, x) => {
        let laplacian = add(x(1), x(-1), scale(x(0),-2));
        let dr2 = squaredLength(subtract(x(1),x(-1))) * 0.25;
        return add(x(0), scale(laplacian, dt / dr2));
    }
}

export function remesh(cu : Curve, seglength : number) {
    // Remesh: Redivide curve to keep nodes evenly distributed
    for (let i = 0; i < cu.length; i++) {
        const a = cu.get(i);
        const b = cu.get(i+1);
        const displacement = subtract(b,a);
        const dr2 = squaredLength(displacement);

        if (dr2 > 4*seglength*seglength) {
            // If vertices are too far apart, add a new vertex in between
            cu.splice(1+i, 0,
                add(a, scale(displacement, seglength * dr2 ** (-1/2)))
            );
        }

        else if (cu.length > 4 && dr2 * 4 < seglength**2) {
            // If vertices are too close, remove one of them
            cu.splice(i--,1);
        }
    }

    // Get points for the polygon
    getPolygonCordinates(cu)

    console.log('CU:::', cu)
}

export function clean(cu : Curve) {
    for (let i = 0; i < cu.length; i++) {
        if (equals(cu.get(i), cu.get(i+2))) cu.splice(i--,2);
    }
}

export function getPolygonCordinates(cu: Curve) {
    const coordinates = cu._data;
    let newCordinates = null;
    if(coordinates.length > 300) {
        newCordinates = coordinates.filter(function(item, index, Arr){
            return index % 15 == 0
        });
    } else if(coordinates.length > 100  && coordinates.length < 300) {
        newCordinates = coordinates.filter(function(item, index, Arr){
            return index % 10 == 0
        });
    } else if(coordinates.length < 100) {
        newCordinates = coordinates.filter(function(item, index, Arr){
            return index % 8 == 0
        });
    }

    writeToCsv(newCordinates)
    console.log('New Coordinates:::', newCordinates)
}

export function writeToCsv(coordinates: any) {
    // if(coordinates && coordinates.length) {
    //     for () {
    //         const element = array[index];
            
    //     }
    // }
    const rows = ['x', 'y']
    let csvContent = "data:text/csv;charset=utf-8," 
    + coordinates.map((e: any) => e.join(",")).join("\n");

    var encodedUri = encodeURI(csvContent);
    window.open(encodedUri);
}
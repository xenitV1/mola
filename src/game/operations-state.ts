import type {SpecialOrder} from './contracts';
import {STARTER_MENU,type Menu,type Ingredient} from './config';
export const freshOperations=()=>({
 special:null as SpecialOrder|null,contractSerial:0,contractsCompleted:0,priority:false,
 catalog:{espresso:1,latte:1,cake:1,tea:0,iced:0,lemonade:0,cheesecake:0} as Record<Menu,number>,
 offered:[...STARTER_MENU],ingredients:{milk:14,pastry:10,cold:10},
 depot:{beans:60,milk:60,pastry:60,cold:60} as Record<Ingredient,number>,deliveryIn:60,
 cleanDishes:36,dirtyDishes:0,dirtyTables:{} as Record<number,number>,
});
export type OperationsState=ReturnType<typeof freshOperations>;

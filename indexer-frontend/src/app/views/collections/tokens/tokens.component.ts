import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { LoadingComponent } from '@components/loading/loading.component';
import { BaseGridComponent, Filter } from '../base-grid/base-grid.component';
import { TranslocoModule } from '@jsverse/transloco';
import { EntitiesService } from '@services/entities.service';
import { FiltersService } from '@services/filters.service';
import { PaginatorModule } from 'primeng/paginator';
import { ChipsModule } from 'primeng/chips';
import { ColumnType, TableComponent } from '@components/table/table.component';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { HederaType } from '@components/hedera-explorer/hedera-explorer.component';

@Component({
    selector: 'tokens',
    templateUrl: './tokens.component.html',
    styleUrls: [
        '../base-grid/base-grid.component.scss',
        './tokens.component.scss',
    ],
    standalone: true,
    imports: [
        CommonModule,
        MatPaginatorModule,
        MatTableModule,
        MatSortModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        FormsModule,
        MatButtonModule,
        LoadingComponent,
        TranslocoModule,
        TableComponent,
        PaginatorModule,
        ChipsModule,
        ReactiveFormsModule,
        InputTextModule,
        InputGroupModule,
        InputGroupAddonModule
    ],
})
export class TokensComponent extends BaseGridComponent {
    columns: any[] = [
        {
            type: ColumnType.HEDERA,
            field: 'tokenId',
            title: 'grid.token_id',
            width: '250px',
            hederaType: HederaType.TOKEN,
        },
        {
            type: ColumnType.TEXT,
            field: 'createdTimestamp',
            title: 'grid.createdTimestamp',
            width: '250px',
            sort: true,
            formatValue: (value: any) => {
                if (value) {
                    value = new Date(Math.floor(value * 1000));
                    const formattedDate = value.toLocaleString();
                    return formattedDate;
                }
            }
        },
        {
            type: ColumnType.TEXT,
            field: 'modifiedTimestamp',
            title: 'grid.modifiedTimestamp',
            width: '250px',
            sort: true,
            formatValue: (value: any) => {
                if (value) {
                    value = new Date(Math.floor(value * 1000));
                    const formattedDate = value.toLocaleString();
                    return formattedDate;
                }
            }
        },
        {
            type: ColumnType.TEXT,
            field: 'name',
            title: 'grid.name',
            width: '250px',
        },
        {
            type: ColumnType.TEXT,
            field: 'symbol',
            title: 'grid.symbol',
            width: '100px',
        },
        {
            type: ColumnType.CHIP,
            field: 'type',
            title: 'grid.name',
            width: '200px',
        },
        {
            type: ColumnType.HEDERA,
            field: 'treasury',
            title: 'grid.treasury',
            width: '200px',
            hederaType: HederaType.ACCOUNT,
        },
        {
            type: ColumnType.BUTTON,
            title: 'grid.open',
            btn_label: 'grid.open',
            width: '100px',
            callback: this.onOpen.bind(this),
        },
    ];

    constructor(
        private entitiesService: EntitiesService,
        private filtersService: FiltersService,
        route: ActivatedRoute,
        router: Router
    ) {
        super(route, router);
        this.filters.push(new Filter({
            type: 'input',
            field: 'tokenId',
            label: 'grid.token_id'
        }))
        this.filters.push(new Filter({
            type: 'input',
            field: 'treasury',
            label: 'grid.treasury'
        }))
    }

    protected loadData(): void {
        const filters = this.getFilters();
        this.loadingData = true;
        this.entitiesService.getTokens(filters).subscribe({
            next: (result) => {
                this.setResult(result);
                setTimeout(() => {
                    this.loadingData = false;
                }, 500);
            },
            error: ({ message }) => {
                this.loadingData = false;
                console.error(message);
            },
        });
    }

    protected loadFilters(): void {
        this.loadingFilters = true;
        this.filtersService.getVcFilters().subscribe({
            next: (result) => {
                setTimeout(() => {
                    this.loadingFilters = false;
                }, 500);
            },
            error: ({ message }) => {
                this.loadingFilters = false;
                console.error(message);
            },
        });
    }

    public override onOpen(element: any) {
        this.router.navigate([`/tokens/${element.tokenId}`]);
    }
}

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_userprofile_seller_status_alter_order_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='customer_name',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='order',
            name='customer_phone',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.AddField(
            model_name='order',
            name='customer_email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='order',
            name='shipping_address',
            field=models.TextField(blank=True, default=''),
        ),
    ]
